import { describe, expect, it } from 'vitest';
import { planTimeline, phaseAt, ease } from '../../src/core/timeline';
import { multimodalProject } from '../fixtures/project';

describe('timeline', () => {
  for (const total of [3_000, 60_000, 120_000, 180_000]) {
    it(`phases are contiguous, non-negative and sum to ${total} ms`, async () => {
      const p = await multimodalProject(total);
      const plan = planTimeline(p);
      expect(plan.phases[0]!.startMs).toBe(0);
      expect(plan.phases[plan.phases.length - 1]!.endMs).toBe(total);
      for (let i = 0; i < plan.phases.length; i++) {
        const ph = plan.phases[i]!;
        expect(ph.endMs).toBeGreaterThanOrEqual(ph.startMs);
        if (i > 0) expect(ph.startMs).toBeCloseTo(plan.phases[i - 1]!.endMs, 6);
      }
      expect(plan.phases.filter((x) => x.kind === 'move')).toHaveLength(3);
    });
  }
  it('cinematic mode gives every leg a meaningful share', async () => {
    const plan = planTimeline(await multimodalProject(30_000));
    const moves = plan.phases.filter((x) => x.kind === 'move');
    const dur = moves.map((m) => m.endMs - m.startMs);
    const total = dur.reduce((a, b) => a + b, 0);
    for (const d of dur) expect(d / total).toBeGreaterThan(0.1);
  });
  it('proportional mode flags estimated timings and is ordered by travel time', async () => {
    const p = { ...(await multimodalProject(30_000)), timeMode: 'proportional' as const };
    const plan = planTimeline(p);
    expect(plan.estimatedTiming.every(Boolean)).toBe(true);
    const moves = plan.phases.filter((x) => x.kind === 'move');
    // Fähre (≈ 190 km @ 30 km/h) dauert real länger als der Flug (≈ 1350 km @ 750 km/h)
    expect(moves[2]!.endMs - moves[2]!.startMs).toBeGreaterThan(moves[1]!.endMs - moves[1]!.startMs);
  });
  it('manual segment duration is honoured', async () => {
    const p = await multimodalProject(30_000);
    p.journey.segments[1]!.manualDurationMs = 5_000;
    const move = planTimeline(p).phases.find((x) => x.kind === 'move' && x.segmentIndex === 1)!;
    expect(move.endMs - move.startMs).toBeCloseTo(5_000, 6);
  });
  it('phaseAt clamps out-of-range times', async () => {
    const plan = planTimeline(await multimodalProject(10_000));
    expect(phaseAt(plan, -100).kind).toBe('intro');
    expect(phaseAt(plan, 1e9).kind).toBe('outro');
  });
  it('easing is bounded and monotonic', () => {
    let prev = -1;
    for (let x = -0.2; x <= 1.2; x += 0.01) {
      const v = ease('easeInOut', x);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });
});
