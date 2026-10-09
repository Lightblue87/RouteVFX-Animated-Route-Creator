import { describe, expect, it } from 'vitest';
import { buildSceneModel, evaluateScene, type CameraState } from '../../src/core/scene/evaluate';
import { createProject, createStop, segmentFromResult } from '../../src/core/project/factory';
import type { GeoPoint } from '../../src/core/types';
import { mapBearingDeg } from '../../src/core/scene/evaluate';

/** Lange, kurvige Straßenroute (~1.500 km, Girona → Garbsen ähnlich): Hauptrichtung Nord mit Schlenkern. */
function longWindingProject(durationMs: number, preset: 'follow' | 'follow-rotate') {
  const start: GeoPoint = { lat: 41.98, lon: 2.82 };
  const end: GeoPoint = { lat: 52.45, lon: 9.6 };
  const geometry: GeoPoint[] = [];
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    // Hauptlinie plus Schlenker (Wellenlänge ~40 km, Amplitude ~0,4°) und eine große S-Kurve in der Mitte
    const wiggle = 0.4 * Math.sin(f * 90) + 2.2 * Math.sin(f * Math.PI * 2);
    geometry.push({ lat: start.lat + (end.lat - start.lat) * f, lon: start.lon + (end.lon - start.lon) * f + wiggle });
  }
  geometry[0] = start;
  geometry[n] = end;
  const stops = [createStop(start, 'A'), createStop(end, 'B')];
  const seg = segmentFromResult(stops[0]!, stops[1]!, 'car', [{ geometry, distanceM: 1_583_000, source: 'test', confidence: 'provider_verified', warnings: [] }]);
  const p = createProject('de', 'Test');
  return { ...p, targetDurationMs: durationMs, cameraPreset: preset, journey: { stops, segments: [seg] } };
}

const angDiff = (a: number, b: number) => Math.abs(((b - a + 540) % 360) - 180);

function sample(preset: 'follow' | 'follow-rotate') {
  const total = 15_000;
  const model = buildSceneModel(longWindingProject(total, preset));
  const cams: CameraState[] = [];
  const veh: GeoPoint[] = [];
  for (let t = 0; t <= total; t += 1000 / 30) {
    const s = evaluateScene(model, t);
    cams.push(s.camera);
    veh.push(s.vehicle!.position);
  }
  return { cams, veh };
}

describe('Kamera auf langen, kurvigen Strecken', () => {
  it('Karte dreht ruhig: begrenzte Drehrate und Gesamtdrehung', () => {
    const { cams } = sample('follow-rotate');
    let maxStep = 0;
    let total = 0;
    for (let i = 1; i < cams.length; i++) {
      const d = angDiff(cams[i - 1]!.bearing, cams[i]!.bearing);
      maxStep = Math.max(maxStep, d);
      total += d;
    }
    console.info(`bearing: max pro Frame ${maxStep.toFixed(2)}°, Summe ${total.toFixed(0)}°`);
    expect(maxStep).toBeLessThan(2); // < 60°/s (vorher bis ~39° pro Bild)
    expect(total).toBeLessThan(260);
  });
  it('Zoom ändert sich gleichmäßig; Mitte weiter gefasst als Anfang und Ende', () => {
    const { cams } = sample('follow');
    let maxStep = 0;
    for (let i = 1; i < cams.length; i++) maxStep = Math.max(maxStep, Math.abs(cams[i]!.zoom - cams[i - 1]!.zoom));
    console.info(`zoom: max pro Frame ${maxStep.toFixed(3)}, Start ${cams[Math.round(cams.length * 0.2)]!.zoom.toFixed(2)}, Mitte ${cams[Math.round(cams.length / 2)]!.zoom.toFixed(2)}`);
    expect(maxStep).toBeLessThan(0.08);
    const mid = cams[Math.round(cams.length / 2)]!.zoom;
    expect(cams[Math.round(cams.length * 0.2)]!.zoom).toBeGreaterThan(mid + 0.5);
    expect(cams[Math.round(cams.length * 0.85)]!.zoom).toBeGreaterThan(mid + 0.5);
  });
  it('Fahrzeug fährt mit mäßigem Spitzentempo (höchstens ~1,6× Durchschnitt)', () => {
    const { veh } = sample('follow');
    const d = (a: GeoPoint, b: GeoPoint) => Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180));
    const steps = veh.slice(1).map((p, i) => d(veh[i]!, p));
    const moving = steps.filter((s) => s > 0);
    const avg = moving.reduce((a, b) => a + b, 0) / moving.length;
    console.info(`Tempo: Spitze/Durchschnitt ${(Math.max(...steps) / avg).toFixed(2)}`);
    expect(Math.max(...steps) / avg).toBeLessThan(1.8);
  });
  it('Start: kein Zoom- oder Positionssprung im Übergang von der Übersicht', () => {
    const { cams } = sample('follow-rotate');
    const head = cams.slice(0, 120); // erste 4 s
    let maxZoomStep = 0;
    for (let i = 1; i < head.length; i++) maxZoomStep = Math.max(maxZoomStep, Math.abs(head[i]!.zoom - head[i - 1]!.zoom));
    console.info(`Start: max Zoomschritt ${maxZoomStep.toFixed(3)}`);
    expect(maxZoomStep).toBeLessThan(0.05);
  });
});

describe('Kartenrichtung (Mercator)', () => {
  it('Sehne auf konstanter Breite ist auf der Karte waagerecht, auch weit im Norden', () => {
    expect(mapBearingDeg({ lat: 80, lon: -60 }, { lat: 80, lon: 60 })).toBeCloseTo(90, 6);
    expect(mapBearingDeg({ lat: 80, lon: 60 }, { lat: 80, lon: -60 })).toBeCloseTo(270, 6);
    expect(mapBearingDeg({ lat: 10, lon: 5 }, { lat: 50, lon: 5 })).toBeCloseTo(0, 6);
    expect(mapBearingDeg({ lat: 50, lon: 5 }, { lat: 10, lon: 5 })).toBeCloseTo(180, 6);
  });
});
