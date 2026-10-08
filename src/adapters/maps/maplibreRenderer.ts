import './setup';
import { Map as MlMap } from 'maplibre-gl';
import { LOGICAL_VIEWPORT, type CameraState, type SceneState } from '../../core/scene/evaluate';
import { drawOverlay, type OverlayOptions } from '../../scene/drawOverlay';
import { buildStyle, type LabelLang } from './styles';

export interface RendererOptions {
  container: HTMLElement;
  styleId: string;
  /** Sprache der Kartenbeschriftung (Detailkarte). */
  lang: LabelLang;
  /** Ausgabe-Pixel je logischem Pixel. 2 → 1080×1920, 4 → 2160×3840. */
  pixelRatio: number;
  interactive: boolean;
  /** Für Export: Zeichenpuffer erhalten, damit drawImage nach dem Render gültig ist. */
  forCapture: boolean;
}

/**
 * MapLibre-Renderer mit deterministischer Kamera. Karte zeigt nur lizenzierte Quellen (MAP_STYLES).
 * renderFrame wartet, bis alle Quellen geladen und gezeichnet sind ('idle'), bevor zusammengesetzt wird.
 */
export class MapLibreSceneRenderer {
  readonly map: MlMap;
  private ready: Promise<void>;

  constructor(private opts: RendererOptions) {
    const el = opts.container;
    el.style.width = `${LOGICAL_VIEWPORT.width}px`;
    el.style.height = `${LOGICAL_VIEWPORT.height}px`;
    this.map = new MlMap({
      container: el,
      style: buildStyle(opts.styleId, document.baseURI, opts.lang),
      center: [10, 50],
      zoom: 3,
      pixelRatio: opts.pixelRatio,
      maxCanvasSize: [4096, 4096],
      interactive: opts.interactive,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: true,
      maxPitch: 60,
      canvasContextAttributes: { preserveDrawingBuffer: opts.forCapture, antialias: true },
    });
    this.ready = new Promise((resolve, reject) => {
      this.map.once('load', () => resolve());
      this.map.once('error', (e) => reject(e.error ?? new Error('map error')));
    });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  setStyle(styleId: string): void {
    this.opts.styleId = styleId;
    this.map.setStyle(buildStyle(styleId, document.baseURI, this.opts.lang));
  }

  applyCamera(c: CameraState): void {
    this.map.jumpTo({ center: [c.center.lon, c.center.lat], zoom: c.zoom, bearing: c.bearing, pitch: c.pitch });
  }

  project = (p: { lat: number; lon: number }) => {
    const pt = this.map.project([p.lon, p.lat]);
    return { x: pt.x, y: pt.y };
  };

  /** Kamera setzen und auf vollständiges Rendern warten (für Export). */
  async renderCamera(c: CameraState, timeoutMs = 10_000): Promise<void> {
    this.applyCamera(c);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('map_render_timeout')), timeoutMs);
      this.map.once('idle', () => {
        clearTimeout(timer);
        resolve();
      });
      this.map.triggerRepaint();
    });
  }

  /** Setzt Karte + Overlay in die Ausgabe-Leinwand zusammen. */
  composite(target: CanvasRenderingContext2D, state: SceneState, overlay: Omit<OverlayOptions, 'scale'>): void {
    const src = this.map.getCanvas();
    const { width, height } = target.canvas;
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(src, 0, 0, width, height);
    drawOverlay(target, state, this.project, { ...overlay, scale: width / LOGICAL_VIEWPORT.width });
  }

  dispose(): void {
    this.map.remove();
  }
}
