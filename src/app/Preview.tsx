import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from './App';
import type { Project } from '../core/project/schema';
import { buildSceneModel, evaluateScene, LOGICAL_VIEWPORT } from '../core/scene/evaluate';
import { MapLibreSceneRenderer } from '../adapters/maps/maplibreRenderer';
import { getStyleInfo } from '../adapters/maps/styles';
import { drawOverlay } from '../scene/drawOverlay';

/**
 * 9:16-Vorschau. Nutzt denselben Scene-Evaluator und Overlay-Zeichner wie der Export.
 * Die Wiedergabezeit stammt aus der Uhr, der Zustand ausschließlich aus evaluateScene(t).
 */
export function Preview({ project }: { project: Project }) {
  const { t, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapLibreSceneRenderer | null>(null);
  const model = useMemo(() => buildSceneModel(project), [project]);
  const [tMs, setTMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(0.5);
  const styleInfo = getStyleInfo(project.mapStyleRef);

  // Auf Containerbreite skalieren (logischer Viewport bleibt 540×960)
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / LOGICAL_VIEWPORT.width, (window.innerHeight * 0.6) / LOGICAL_VIEWPORT.height, 1)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const r = new MapLibreSceneRenderer({ container: mapRef.current!, styleId: project.mapStyleRef, lang: project.locale, pixelRatio: Math.min(2, devicePixelRatio || 1), interactive: false, forCapture: false });
    rendererRef.current = r;
    r.map.on('render', () => draw());
    return () => {
      r.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.mapStyleRef, project.locale]);

  const stateRef = useRef({ model, tMs, locale });
  stateRef.current = { model, tMs, locale };

  function draw() {
    const r = rendererRef.current;
    const c = canvasRef.current;
    if (!r || !c) return;
    const { model: m, tMs: tt, locale: loc } = stateRef.current;
    const state = evaluateScene(m, tt);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    drawOverlay(ctx, state, r.project, {
      locale: loc,
      overlays: m.project.overlays,
      vehicleColor: m.project.vehicleColor,
      attribution: styleInfo.attribution,
      dark: styleInfo.variant === 'dark',
      scale: c.width / LOGICAL_VIEWPORT.width,
    });
  }

  // Kamera je Zeitpunkt
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.applyCamera(evaluateScene(model, tMs).camera);
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMs, model]);

  // Wiedergabe
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - tMs;
    const loop = (now: number) => {
      const tt = now - start;
      if (tt >= model.plan.totalMs) {
        setTMs(model.plan.totalMs);
        setPlaying(false);
        return;
      }
      setTMs(tt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  return (
    <div className="preview" ref={wrapRef}>
      <div className="stage" style={{ width: LOGICAL_VIEWPORT.width * scale, height: LOGICAL_VIEWPORT.height * scale }}>
        <div className="stage-inner" style={{ transform: `scale(${scale})` }}>
          <div ref={mapRef} className="stage-map" />
          <canvas ref={canvasRef} className="stage-overlay" width={LOGICAL_VIEWPORT.width * dpr} height={LOGICAL_VIEWPORT.height * dpr} data-testid="preview-canvas" />
        </div>
      </div>
      <div className="row transport">
        <button className="btn primary icon" onClick={() => { if (tMs >= model.plan.totalMs) setTMs(0); setPlaying(!playing); }} aria-label={playing ? t('anim.pause') : t('anim.play')} data-testid="play">
          {playing ? '❚❚' : '▶'}
        </button>
        <input className="grow" type="range" min={0} max={model.plan.totalMs} step={10} value={tMs}
          onChange={(e) => { setPlaying(false); setTMs(Number(e.target.value)); }} aria-label="Timeline" data-testid="scrub" />
        <span className="small mono">{(tMs / 1000).toFixed(1)} / {(model.plan.totalMs / 1000).toFixed(1)} s</span>
      </div>
    </div>
  );
}
