import type { Project, RouteSegment } from '../project/schema';
import type { TransportMode } from '../types';

export type Easing = 'linear' | 'easeInOut';

export function ease(kind: Easing, x: number): number {
  const t = Math.min(1, Math.max(0, x));
  if (kind === 'linear') return t;
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Typische Reisegeschwindigkeiten (km/h) – nur für als „geschätzt“ markierte Dauer im proportionalen Modus. */
export const TYPICAL_SPEED_KMH: Record<TransportMode, number> = {
  car: 80, motorcycle: 75, plane: 750, ship: 30, train: 120, bike: 18, walk: 4.5, bus: 50,
};

export type Phase =
  | { kind: 'intro'; startMs: number; endMs: number }
  | { kind: 'move'; segmentIndex: number; startMs: number; endMs: number }
  | { kind: 'pause'; stopIndex: number; startMs: number; endMs: number }
  | { kind: 'outro'; startMs: number; endMs: number };

export interface TimelinePlan {
  totalMs: number;
  phases: Phase[];
  /** Je Segment: true, wenn die Zeitbasis im proportionalen Modus geschätzt wurde. */
  estimatedTiming: boolean[];
}

/** Zeitbasis eines Segments in Sekunden + ob sie geschätzt ist. */
export function segmentTravelTimeS(s: RouteSegment): { seconds: number; estimated: boolean } {
  if (s.measuredTimeS && s.measuredTimeS > 0) return { seconds: s.measuredTimeS, estimated: false };
  if (s.etaS && s.etaS > 0) return { seconds: s.etaS, estimated: s.confidence === 'estimated' };
  return { seconds: (s.distanceM / 1000 / TYPICAL_SPEED_KMH[s.mode]) * 3600, estimated: true };
}

/**
 * Verteilt targetDurationMs deterministisch auf Intro, Segmentbewegung, Stopp-Pausen und Outro.
 * Garantiert: keine negativen Dauern, Summe == totalMs, jede Bewegung >= minMoveMs (soweit Budget reicht).
 */
export function planTimeline(project: Project): TimelinePlan {
  const totalMs = project.targetDurationMs;
  const segs = project.journey.segments;
  const stops = project.journey.stops;
  if (segs.length === 0) return { totalMs, phases: [{ kind: 'intro', startMs: 0, endMs: totalMs }], estimatedTiming: [] };

  const introMs = Math.min(1200, totalMs * 0.08);
  const outroMs = Math.min(1500, totalMs * 0.1);
  // Pausen an Zwischenstopps (nicht Start/Ziel), maximal 30 % des Budgets.
  const rawPauses = stops.slice(1, -1).map((s) => s.pauseMs);
  const pauseSum = rawPauses.reduce((a, b) => a + b, 0);
  const pauseBudget = totalMs * 0.3;
  const pauseScale = pauseSum > pauseBudget ? pauseBudget / pauseSum : 1;
  const pauses = rawPauses.map((p) => p * pauseScale);
  const moveBudget = Math.max(1, totalMs - introMs - outroMs - pauses.reduce((a, b) => a + b, 0));

  const estimatedTiming = segs.map(() => false);
  let weights: number[];
  if (project.timeMode === 'proportional') {
    weights = segs.map((s, i) => {
      const { seconds, estimated } = segmentTravelTimeS(s);
      estimatedTiming[i] = estimated;
      return Math.max(seconds, 1);
    });
  } else {
    // Filmisch: Wurzel der Distanz glättet extreme Unterschiede (Flug vs. Fähre).
    weights = segs.map((s) => Math.sqrt(Math.max(s.distanceM, 1)));
    const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
    weights = weights.map((w) => Math.max(w, mean * 0.35));
  }

  // Manuelle Segmentdauern haben Vorrang; der Rest wird nach Gewicht verteilt.
  const manualTotal = segs.reduce((a, s) => a + (s.manualDurationMs ?? 0), 0);
  const manualScale = manualTotal > moveBudget * 0.95 ? (moveBudget * 0.95) / manualTotal : 1;
  const freeBudget = moveBudget - manualTotal * manualScale;
  const freeWeight = segs.reduce((a, s, i) => a + (s.manualDurationMs ? 0 : weights[i]!), 0);
  const moveMs = segs.map((s, i) =>
    s.manualDurationMs ? s.manualDurationMs * manualScale : freeWeight > 0 ? (weights[i]! / freeWeight) * freeBudget : 0,
  );

  const phases: Phase[] = [];
  let t = 0;
  const push = (p: Phase) => {
    phases.push(p);
    t = p.endMs;
  };
  push({ kind: 'intro', startMs: 0, endMs: introMs });
  segs.forEach((_, i) => {
    push({ kind: 'move', segmentIndex: i, startMs: t, endMs: t + moveMs[i]! });
    if (i < segs.length - 1 && pauses[i]! > 0) push({ kind: 'pause', stopIndex: i + 1, startMs: t, endMs: t + pauses[i]! });
  });
  push({ kind: 'outro', startMs: t, endMs: totalMs });
  return { totalMs, phases, estimatedTiming };
}

export function phaseAt(plan: TimelinePlan, tMs: number): Phase {
  const t = Math.min(Math.max(tMs, 0), plan.totalMs);
  for (const p of plan.phases) if (t < p.endMs) return p;
  return plan.phases[plan.phases.length - 1]!;
}
