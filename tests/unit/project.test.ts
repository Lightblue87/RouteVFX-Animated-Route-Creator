import { describe, expect, it } from 'vitest';
import { migrateAndValidate, ProjectLoadError } from '../../src/core/project/migrations';
import { validateJourney } from '../../src/core/project/schema';
import { createProject } from '../../src/core/project/factory';
import { addStop, appendGpxTrack, missingPairs, moveStop, normalizeSegments, removeStop } from '../../src/features/projects/journey';
import { multimodalProject, HANNOVER, BARCELONA } from '../fixtures/project';

describe('project model', () => {
  it('valid project round-trips through validation', async () => {
    const p = await multimodalProject();
    expect(migrateAndValidate(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(validateJourney(p)).toEqual([]);
  });
  it('rejects newer schema versions without modifying data', () => {
    const p = { ...createProject('de'), schemaVersion: 99 };
    expect(() => migrateAndValidate(p)).toThrowError(ProjectLoadError);
    expect(p.schemaVersion).toBe(99);
  });
  it('rejects durations above 180 s and invalid colors', () => {
    expect(() => migrateAndValidate({ ...createProject('de'), targetDurationMs: 180_001 })).toThrow();
    expect(() => migrateAndValidate({ ...createProject('de'), vehicleColor: 'red' })).toThrow();
  });
  it('journey mutations keep segments consistent', async () => {
    let p = await multimodalProject();
    p = moveStop(p, 1, 1); // Reihenfolge ändern → zwei Paare fehlen
    expect(missingPairs(p).length).toBeGreaterThan(0);
    p = normalizeSegments(p);
    expect(validateJourney(p).filter((e) => e !== 'segment_count_mismatch')).toEqual([]);
    p = removeStop(p, p.journey.stops[0]!.id);
    expect(p.journey.segments.every((s) => p.journey.stops.some((st) => st.id === s.fromStopId))).toBe(true);
  });
  it('GPX track import creates recorded segment with measured time', () => {
    let p = createProject('de');
    p = addStop(p, HANNOVER, 'Hannover');
    p = appendGpxTrack(p, { name: 'Track', points: [HANNOVER, BARCELONA], distanceM: 1_347_000, durationS: 3600 });
    expect(p.journey.stops).toHaveLength(2); // Startpunkt = vorhandener Stopp (< 200 m)
    const s = p.journey.segments[0]!;
    expect(s.confidence).toBe('imported_recorded');
    expect(s.measuredTimeS).toBe(3600);
    expect(() => migrateAndValidate(p)).not.toThrow();
  });
});
