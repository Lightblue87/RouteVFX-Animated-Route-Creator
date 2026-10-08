import { describe, expect, it } from 'vitest';
import { buildSceneModel, evaluateScene } from '../../src/core/scene/evaluate';
import { multimodalProject } from '../fixtures/project';

describe('evaluateScene (deterministisch)', () => {
  it('same input → identical state; random seek order equals sequential', async () => {
    for (const total of [60_000, 120_000, 180_000]) {
      const p = await multimodalProject(total);
      const model = buildSceneModel(p);
      const times = Array.from({ length: 200 }, (_, i) => (i * total) / 199);
      const sequential = times.map((t) => JSON.stringify(evaluateScene(model, t)));
      const shuffled = [...times.keys()].sort((a, b) => ((a * 7919) % 200) - ((b * 7919) % 200));
      for (const i of shuffled) expect(JSON.stringify(evaluateScene(model, times[i]!))).toBe(sequential[i]);
      // separates Modell aus gleichem Projekt
      expect(JSON.stringify(evaluateScene(buildSceneModel(p), times[57]!))).toBe(sequential[57]);
    }
  });
  it('distance counter is monotonic and reaches the total', async () => {
    const model = buildSceneModel(await multimodalProject(20_000));
    let prev = -1;
    for (let t = 0; t <= 20_000; t += 100) {
      const s = evaluateScene(model, t);
      expect(s.distanceDoneM).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = s.distanceDoneM;
    }
    const end = evaluateScene(model, 20_000);
    expect(end.distanceDoneM).toBeCloseTo(end.distanceTotalM, 3);
    expect(end.progress).toBe(1);
  });
  it('mode change overlay appears at each new mode and estimated legs are flagged', async () => {
    const model = buildSceneModel(await multimodalProject(30_000));
    const moves = model.plan.phases.filter((p) => p.kind === 'move');
    for (const m of moves) expect(evaluateScene(model, m.startMs + 300).modeChange).not.toBeNull();
    const ship = moves[2]!;
    expect(evaluateScene(model, (ship.startMs + ship.endMs) / 2).geometryNotice).toBe('estimated');
    const plane = moves[1]!;
    expect(evaluateScene(model, (plane.startMs + plane.endMs) / 2).geometryNotice).toBe('derived');
  });
  it('camera values are finite and zoom within range', async () => {
    const model = buildSceneModel(await multimodalProject(15_000));
    for (let t = 0; t <= 15_000; t += 250) {
      const c = evaluateScene(model, t).camera;
      for (const v of [c.center.lat, c.center.lon, c.zoom, c.bearing, c.pitch]) expect(Number.isFinite(v)).toBe(true);
      expect(c.zoom).toBeGreaterThanOrEqual(0);
      expect(c.zoom).toBeLessThanOrEqual(14);
    }
  });
  it('empty project evaluates without throwing', async () => {
    const p = await multimodalProject(5_000);
    const model = buildSceneModel({ ...p, journey: { stops: [], segments: [] } });
    expect(evaluateScene(model, 1000).vehicle).toBeNull();
  });
});
