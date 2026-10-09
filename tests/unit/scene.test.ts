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

describe('Stopp-Zoom', () => {
  it('zooms closer during the pause of a stop with zoomIn', async () => {
    const p = await multimodalProject(30_000);
    p.journey.stops[2]!.pauseMs = 3000;
    const base = buildSceneModel(structuredClone(p));
    p.journey.stops[2]!.zoomIn = true;
    const zoomed = buildSceneModel(p);
    const pause = zoomed.plan.phases.find((x) => x.kind === 'pause' && x.stopIndex === 2)!;
    const mid = (pause.startMs + pause.endMs) / 2;
    expect(evaluateScene(zoomed, mid).camera.zoom).toBeGreaterThan(evaluateScene(base, mid).camera.zoom + 0.5);
  });
});

describe('Kamera-Übergang hält das Fahrzeug im Bild', () => {
  it('vehicle stays inside the logical viewport during intro and outro', async () => {
    const { mercatorX, mercatorY } = await import('../../src/core/geodesy');
    const model = buildSceneModel(await multimodalProject(8_000));
    for (let t = 0; t <= 8_000; t += 40) {
      const s = evaluateScene(model, t);
      const sc = 512 * 2 ** s.camera.zoom;
      // Bearing ignoriert (Preset 'follow' → 0)
      const x = (mercatorX(s.vehicle!.position.lon) - mercatorX(s.camera.center.lon)) * sc + 270;
      const y = (mercatorY(s.vehicle!.position.lat) - mercatorY(s.camera.center.lat)) * sc + 480;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(540);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(960);
    }
  });
});

describe('Fahrzeug-Illustration', () => {
  it('zeichnet jedes Verkehrsmittel ohne Fehler und stellt den Canvas-Zustand wieder her', async () => {
    const { drawVehicleFigure } = await import('../../src/scene/drawOverlay');
    const { TRANSPORT_MODES } = await import('../../src/core/types');
    for (const mode of TRANSPORT_MODES) {
      let depth = 0;
      let paints = 0;
      const ctx = new Proxy({} as Record<string, unknown>, {
        get: (t, k: string) => {
          if (k === 'save') return () => depth++;
          if (k === 'restore') return () => depth--;
          if (k === 'fill' || k === 'stroke' || k === 'fillRect' || k === 'strokeRect') return () => paints++;
          return k in t ? t[k] : () => undefined;
        },
        set: (t, k: string, v) => ((t[k] = v), true),
      }) as unknown as CanvasRenderingContext2D;
      drawVehicleFigure(ctx, mode, 100, 100, 1.2, '#ffffff');
      expect(depth, mode).toBe(0);
      expect(paints, mode).toBeGreaterThan(0);
    }
  });
});
