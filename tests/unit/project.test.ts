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
  it('Projekte ohne vehicleStyle (älterer Stand) bleiben ladbar und nutzen das Symbol', () => {
    const { vehicleStyle: _omit, ...old } = createProject('de');
    expect(migrateAndValidate(old).vehicleStyle).toBe('symbol');
    expect(createProject('de').vehicleStyle).toBe('figure');
    expect(() => migrateAndValidate({ ...createProject('de'), vehicleStyle: 'x' })).toThrow();
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

describe('manuelle Geometriekorrektur', async () => {
  const { applyControlPoints, controlPointsOf } = await import('../../src/features/projects/journey');
  it('control points are few and keep endpoints', async () => {
    const p = await multimodalProject();
    const seg = p.journey.segments[2]!; // Schiff, geschätzt
    const cp = controlPointsOf(seg);
    expect(cp.length).toBeGreaterThanOrEqual(2);
    expect(cp.length).toBeLessThanOrEqual(16);
    expect(cp[0]).toEqual({ lat: seg.geometry[0]!.lat, lon: seg.geometry[0]!.lon });
  });
  it('moving a control point changes geometry, distance and provenance', async () => {
    const p = await multimodalProject();
    const seg = p.journey.segments[2]!;
    const cp = controlPointsOf(seg);
    const detour = [cp[0]!, { lat: 40.6, lon: 3.6 }, cp[cp.length - 1]!]; // Bogen östlich um Mallorca-Nordspitze
    const edited = applyControlPoints(seg, detour);
    expect(edited.confidence).toBe('manually_edited');
    expect(edited.source).toBe('manual');
    expect(edited.distanceM).toBeGreaterThan(seg.distanceM);
    expect(edited.geometryVersion).toBe(seg.geometryVersion + 1);
    expect(edited.etaS).toBeUndefined();
    expect(controlPointsOf(edited)).toEqual(detour);
    expect(() => migrateAndValidate({ ...p, journey: { ...p.journey, segments: [p.journey.segments[0], p.journey.segments[1], edited] } })).not.toThrow();
  });
  it('antimeridian edits stay continuous', async () => {
    const p = await multimodalProject();
    const edited = applyControlPoints(p.journey.segments[1]!, [{ lat: 35, lon: 170 }, { lat: 40, lon: -170 }]);
    expect(edited.distanceM / 1000).toBeLessThan(2500);
  });
});

describe('Moduswechsel überschreibt keine späteren Änderungen', async () => {
  const { applyControlPoints, changeSegmentMode, controlPointsOf, replaceSegmentIfUnchanged } = await import('../../src/features/projects/journey');
  it('applies the new segment when nothing changed meanwhile', async () => {
    const p = await multimodalProject();
    const r = (await changeSegmentMode(p, p.journey.segments[2]!.id, 'train', { onlineAllowed: false }))!;
    const next = replaceSegmentIfUnchanged(p, r.base, r.segment);
    expect(next.journey.segments[2]!.mode).toBe('train');
  });
  it('drops a stale routing result if the segment was edited in the meantime', async () => {
    const p = await multimodalProject();
    const seg = p.journey.segments[2]!;
    const pending = changeSegmentMode(p, seg.id, 'train', { onlineAllowed: false });
    // Nutzer bearbeitet die Linie, bevor das Routing antwortet
    const cp = controlPointsOf(seg);
    const edited = applyControlPoints(seg, [cp[0]!, { lat: 40.6, lon: 3.6 }, cp[cp.length - 1]!]);
    const cur = { ...p, journey: { ...p.journey, segments: [p.journey.segments[0]!, p.journey.segments[1]!, edited] } };
    const r = (await pending)!;
    const next = replaceSegmentIfUnchanged(cur, r.base, r.segment);
    expect(next).toBe(cur);
    expect(next.journey.segments[2]!.confidence).toBe('manually_edited');
    expect(next.journey.stops).toBe(cur.journey.stops);
  });
});

describe('Fade-Eingabe', async () => {
  const { fadeMsFromSeconds, AudioSettingsSchema } = await import('../../src/core/project/schema');
  it('clamps to the schema range and rejects non-numbers', () => {
    expect(fadeMsFromSeconds(1.5)).toBe(1500);
    expect(fadeMsFromSeconds(-3)).toBe(0);
    expect(fadeMsFromSeconds(99)).toBe(20_000);
    expect(fadeMsFromSeconds(Number.NaN)).toBe(0);
    for (const v of [-3, 99, Number.NaN, 0.0004]) {
      const ms = fadeMsFromSeconds(v);
      expect(AudioSettingsSchema.safeParse({ assetId: 'a', fileName: 'f', gain: 1, fadeInMs: ms, fadeOutMs: ms, muted: false }).success).toBe(true);
    }
  });
});

describe('Konkurrierende Moduswechsel: letzte Auswahl gewinnt', async () => {
  const { changeSegmentMode, replaceSegmentIfUnchanged, LatestRequestGate } = await import('../../src/features/projects/journey');
  // Simuliert RoutePanel.setMode: Antwort nur übernehmen, wenn sie zur letzten Anfrage des Abschnitts gehört.
  async function run(order: 'first-then-second' | 'second-then-first') {
    const p = await multimodalProject();
    const seg = p.journey.segments[0]!;
    const gate = new LatestRequestGate();
    const tWalk = gate.begin(seg.id);
    const walk = (await changeSegmentMode(p, seg.id, 'walk', { onlineAllowed: false }))!;
    const tBike = gate.begin(seg.id);
    const bike = (await changeSegmentMode(p, seg.id, 'bike', { onlineAllowed: false }))!;
    const answers = order === 'first-then-second' ? [[walk, tWalk], [bike, tBike]] as const : [[bike, tBike], [walk, tWalk]] as const;
    let cur = p;
    for (const [r, token] of answers) {
      if (gate.isLatest(seg.id, token)) cur = replaceSegmentIfUnchanged(cur, r.base, r.segment);
      gate.end(seg.id, token);
    }
    return cur.journey.segments[0]!.mode;
  }
  it('walk then bike requested, answers in request order → bike', async () => {
    expect(await run('first-then-second')).toBe('bike');
  });
  it('walk then bike requested, answers in reverse order → bike', async () => {
    expect(await run('second-then-first')).toBe('bike');
  });
});
