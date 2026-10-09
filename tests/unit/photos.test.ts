import { describe, expect, it } from 'vitest';
import { alongLine } from '../../src/core/geodesy';
import { buildSceneModel, evaluateScene } from '../../src/core/scene/evaluate';
import { migrateAndValidate } from '../../src/core/project/migrations';
import { createProject, newId } from '../../src/core/project/factory';
import type { Photo } from '../../src/core/project/schema';
import { multimodalProject } from '../fixtures/project';

const photo = (position: Photo['position'], extra: Partial<Photo> = {}): Photo => ({
  id: newId(), assetId: newId(), fileName: 'p.jpg', width: 800, height: 600, position, positionSource: position ? 'manual' : null, caption: '', holdMs: 2000, ...extra,
});

async function withPhotos(make: (m: ReturnType<typeof buildSceneModel>) => Photo[], total = 30_000) {
  const p = await multimodalProject(total);
  const base = buildSceneModel(p);
  const photos = make(base);
  return { p: { ...p, photos }, photos };
}
const at = (m: ReturnType<typeof buildSceneModel>, seg: number, f: number) => alongLine(m.segments[seg]!.index, f * m.segments[seg]!.index.totalM).point;

describe('Fotos auf der Route', () => {
  it('Projekte ohne Fotofeld bleiben ladbar (Standard: keine Fotos); ungültige Daten werden abgelehnt', () => {
    const { photos: _omit, ...old } = createProject('de');
    expect(migrateAndValidate(old).photos).toEqual([]);
    expect(() => migrateAndValidate({ ...createProject('de'), photos: Array.from({ length: 13 }, () => photo(null)) })).toThrow();
    expect(() => migrateAndValidate({ ...createProject('de'), photos: [{ ...photo(null), holdMs: 100 }] })).toThrow();
    expect(() => migrateAndValidate({ ...createProject('de'), photos: [photo({ lat: 99, lon: 0 })] })).toThrow();
  });

  it('Foto erscheint, wenn das Fahrzeug an seinem Punkt vorbeikommt – im richtigen Abschnitt und in zeitlicher Reihenfolge', async () => {
    const { p, photos } = await withPhotos((m) => [photo(at(m, 2, 0.5)), photo(at(m, 0, 0.5))]);
    const model = buildSceneModel(p);
    expect(model.photoMoments).toHaveLength(2);
    const [first, second] = model.photoMoments;
    expect(first!.photoId).toBe(photos[1]!.id); // Abschnitt 0 kommt vor Abschnitt 2
    expect(second!.photoId).toBe(photos[0]!.id);
    const moves = model.plan.phases.filter((x) => x.kind === 'move');
    expect(first!.startMs).toBeGreaterThanOrEqual(moves[0]!.startMs);
    expect(first!.startMs).toBeLessThanOrEqual(moves[0]!.endMs);
    expect(second!.startMs).toBeGreaterThanOrEqual(moves[2]!.startMs);
    expect(second!.startMs).toBeLessThanOrEqual(moves[2]!.endMs);
    expect(first!.distanceToRouteM).toBeLessThan(500);
    // Fahrzeug steht zum Startzeitpunkt (fast) am Fotopunkt: Zeit entspricht dem Fortschritt dort
    const s = evaluateScene(model, first!.startMs);
    const v = s.vehicle!.position;
    const target = photos[1]!.position!;
    expect(Math.hypot(v.lat - target.lat, v.lon - target.lon)).toBeLessThan(0.3);
  });

  it('Blendet weich ein und aus und zeigt höchstens ein Foto zugleich; ohne Position kein Foto', async () => {
    const { p } = await withPhotos((m) => [photo(at(m, 0, 0.4)), photo(at(m, 0, 0.42)), photo(null)]);
    const model = buildSceneModel(p);
    expect(model.photoMoments).toHaveLength(2); // das Foto ohne Position fehlt
    const [a, b] = model.photoMoments;
    expect(b!.startMs).toBeGreaterThanOrEqual(a!.endMs); // nacheinander statt übereinander
    const early = evaluateScene(model, a!.startMs + 1).photo;
    expect(early!.opacity).toBeLessThan(0.1);
    const mid = evaluateScene(model, (a!.startMs + a!.endMs) / 2).photo!;
    expect(mid.opacity).toBeCloseTo(1, 5);
    expect(mid.photoId).toBe(a!.photoId);
    const late = evaluateScene(model, a!.endMs - 1).photo;
    expect(late!.opacity).toBeLessThan(0.1);
    expect(evaluateScene(model, 0).photo).toBeNull();
    expect(evaluateScene(model, model.plan.totalMs).photo).toBeNull();
    // nie zwei Fotos gleichzeitig, in keinem Bild
    for (let t = 0; t <= model.plan.totalMs; t += 100) {
      const open = model.photoMoments.filter((m) => t >= m.startMs && t < m.endMs).length;
      expect(open).toBeLessThanOrEqual(1);
    }
  });

  it('Foto weit abseits der Route wird am nächstgelegenen Punkt gezeigt und mit Abstand gemeldet', async () => {
    const { p } = await withPhotos((m) => {
      const near = at(m, 0, 0.5);
      return [photo({ lat: near.lat + 1.5, lon: near.lon })];
    });
    const model = buildSceneModel(p);
    expect(model.photoMoments).toHaveLength(1);
    expect(model.photoMoments[0]!.distanceToRouteM).toBeGreaterThan(100_000);
  });

  it('Szene ist deterministisch: gleiche Zeit → gleicher Zustand, unabhängig von der Abfragereihenfolge', async () => {
    const { p } = await withPhotos((m) => [photo(at(m, 0, 0.3)), photo(at(m, 1, 0.5)), photo(at(m, 2, 0.6))]);
    const model = buildSceneModel(p);
    const times = Array.from({ length: 150 }, (_, i) => (i * model.plan.totalMs) / 149);
    const seq = times.map((t) => JSON.stringify(evaluateScene(model, t)));
    [...times.keys()].reverse().forEach((i) => expect(JSON.stringify(evaluateScene(model, times[i]!))).toBe(seq[i]));
  });

  it('Sehr kurzes Video: Fotos am Ende ohne Platz werden ausgelassen, nichts ragt über das Ende hinaus', async () => {
    const { p } = await withPhotos((m) => [photo(at(m, 2, 1), { holdMs: 6000 })], 5000);
    const model = buildSceneModel(p);
    for (const m of model.photoMoments) expect(m.endMs).toBeLessThanOrEqual(model.plan.totalMs);
  });
});
