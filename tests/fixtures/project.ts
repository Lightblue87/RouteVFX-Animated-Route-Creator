import { createProject, createStop, segmentFromResult } from '../../src/core/project/factory';
import type { Project } from '../../src/core/project/schema';
import { greatCircleProvider, estimatedProvider } from '../../src/adapters/routing/local';
import type { TransportMode } from '../../src/core/types';

export const HANNOVER = { lat: 52.367, lon: 9.7167 };
export const BARCELONA = { lat: 41.3852, lon: 2.1814 };
export const PALMA = { lat: 39.5743, lon: 2.6542 };
export const HAJ_AIRPORT = { lat: 52.4611, lon: 9.6851 };

/** Hannover → Flughafen (Auto, geschätzt) → Barcelona (Flug) → Palma (Schiff, geschätzt). */
export async function multimodalProject(durationMs = 30_000): Promise<Project> {
  const p = createProject('de', 'Test');
  const stops = [createStop(HANNOVER, 'Hannover'), createStop(HAJ_AIRPORT, 'HAJ'), createStop(BARCELONA, 'Barcelona'), createStop(PALMA, 'Palma')];
  const modes: TransportMode[] = ['car', 'plane', 'ship'];
  const segments = [];
  for (let i = 0; i < modes.length; i++) {
    const req = { start: stops[i]!.position, end: stops[i + 1]!.position, via: [], mode: modes[i]! };
    const res = modes[i] === 'plane' ? await greatCircleProvider.route(req) : await estimatedProvider.route(req);
    segments.push(segmentFromResult(stops[i]!, stops[i + 1]!, modes[i]!, res));
  }
  return { ...p, targetDurationMs: durationMs, journey: { stops, segments } };
}
