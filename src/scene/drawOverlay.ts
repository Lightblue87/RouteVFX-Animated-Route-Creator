import type { SceneState } from '../core/scene/evaluate';
import { LOGICAL_VIEWPORT } from '../core/scene/evaluate';
import type { GeoPoint, TransportMode } from '../core/types';
import { formatKm, translate, type Locale } from '../i18n';

export type Projector = (p: GeoPoint) => { x: number; y: number };

export interface OverlayOptions {
  locale: Locale;
  overlays: { showTitle: boolean; showDistance: boolean; showProgress: boolean; showModeChange: boolean; showStopLabels: boolean; showEstimateNotice: boolean };
  vehicleColor: string;
  attribution: string;
  dark: boolean;
  /** Ausgabe-Pixel je logischem Pixel (2 für 1080p, 4 für 4K). */
  scale: number;
}

const FONT = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Zeichnet Routenlinien, Stopps, Fahrzeug und Text-Overlays in logischen Koordinaten (540×960).
 * Wird von Vorschau und Export identisch verwendet. Texte werden nur per fillText gezeichnet (kein HTML → kein XSS).
 */
export function drawOverlay(ctx: CanvasRenderingContext2D, state: SceneState, project: Projector, o: OverlayOptions): void {
  const { width: W, height: H } = LOGICAL_VIEWPORT;
  ctx.save();
  ctx.setTransform(o.scale, 0, 0, o.scale, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Linien: zuerst blasse Restlinie, dann gezeichneter Teil mit Kontur
  for (const line of state.lines) {
    if (line.full.length < 2) continue;
    const dash = line.style.kind === 'dashed' ? [line.style.widthPx * 1.6, line.style.widthPx * 1.4] : [];
    const isApprox = line.confidence === 'estimated';
    strokePath(ctx, line.full.map(project), line.style.color, line.style.widthPx * 0.7, 0.25, isApprox ? [4, 6] : dash);
    if (line.drawn.length >= 2) {
      const pts = line.drawn.map(project);
      strokePath(ctx, pts, o.dark ? '#000000' : '#ffffff', line.style.widthPx + 4, 0.9, []);
      strokePath(ctx, pts, line.style.color, line.style.widthPx, 1, isApprox ? [line.style.widthPx * 0.5, line.style.widthPx * 1.6] : dash);
    }
  }

  // Stopps
  const projected = state.stops.map((s) => ({ s, p: project(s.position) }));
  for (const { s, p } of projected) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.reached ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = s.reached ? '#ffffff' : 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1c1c1e';
    ctx.stroke();
  }
  // Labels mit einfacher Kollisionsvermeidung: aktiver Stopp, dann Start/Ziel, dann übrige; überlappende werden ausgelassen.
  if (o.overlays.showStopLabels) {
    const n = projected.length;
    const order = projected
      .map((x, i) => ({ ...x, prio: x.s.isActive ? 0 : i === 0 || i === n - 1 ? 1 : 2, i }))
      .filter((x) => x.s.label && x.s.reached)
      .sort((a, b) => a.prio - b.prio || a.i - b.i);
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    ctx.font = `600 15px ${FONT}`;
    for (const { s, p } of order) {
      const w = Math.min(ctx.measureText(s.label).width, 440) + 21;
      const box = { x0: p.x - w / 2, y0: p.y - 22 - 15, x1: p.x + w / 2, y1: p.y - 22 + 15 };
      if (placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      placed.push(box);
      pill(ctx, s.label, p.x, p.y - 22, 15, s.isActive ? 1 : 0.85, o.dark);
    }
  }

  // Fahrzeug
  if (state.vehicle) {
    const p = project(state.vehicle.position);
    const rot = ((state.vehicle.headingDeg - state.camera.bearing) * Math.PI) / 180;
    drawVehicle(ctx, state.vehicle.mode, p.x, p.y, rot, o.vehicleColor);
  }

  // Lesbarkeits-Scrims hinter Titel und Kilometerzähler (WCAG-Kontrast für weiße Schrift)
  if (o.overlays.showTitle && state.title) scrim(ctx, 0, 230, true);
  if (o.overlays.showDistance || o.overlays.showProgress) scrim(ctx, H - 230, H, false);

  // Titel
  if (o.overlays.showTitle && state.title) {
    ctx.font = `700 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    shadowText(ctx, state.title, W / 2, 92, W - 60);
  }
  // Verkehrsmittelwechsel
  if (o.overlays.showModeChange && state.modeChange && state.modeChange.opacity > 0) {
    pill(ctx, translate(o.locale, `mode.${state.modeChange.mode}`), W / 2, 160, 20, state.modeChange.opacity, o.dark);
  }
  // Kilometer
  if (o.overlays.showDistance && state.distanceTotalM > 0) {
    ctx.font = `700 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    shadowText(ctx, formatKm(o.locale, state.distanceDoneM), W / 2, H - 150, W - 60);
    ctx.font = `500 18px ${FONT}`;
    shadowText(ctx, '/ ' + formatKm(o.locale, state.distanceTotalM), W / 2, H - 124, W - 60);
  }
  // Näherungshinweis
  if (o.overlays.showEstimateNotice && state.geometryNotice) {
    pill(ctx, translate(o.locale, `overlay.${state.geometryNotice}`), W / 2, H - 92, 13, 0.95, o.dark);
  }
  // Fortschritt
  if (o.overlays.showProgress) {
    const x = 50, w = W - 100, y = H - 62;
    roundRect(ctx, x, y, w, 6, 3, 'rgba(0,0,0,0.25)');
    roundRect(ctx, x, y, Math.max(6, w * state.progress), 6, 3, '#ffffff');
  }
  // Attribution (immer sichtbar, nicht abschaltbar)
  ctx.font = `500 10px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = o.dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';
  ctx.fillText(o.attribution, W - 10, H - 8, W - 20);
  ctx.restore();
}

function scrim(ctx: CanvasRenderingContext2D, y0: number, y1: number, top: boolean) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(top ? 0 : 1, 'rgba(0,0,0,0.42)');
  g.addColorStop(top ? 1 : 0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, LOGICAL_VIEWPORT.width, y1 - y0);
}

function strokePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string, width: number, alpha: number, dash: number[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function shadowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(text, x + 1.5, y + 2, maxW);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y, maxW);
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, alpha: number, dark: boolean) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.font = `600 ${size}px ${FONT}`;
  const w = Math.min(ctx.measureText(text).width, 440) + size * 1.4;
  const h = size * 1.9;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2, dark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.92)');
  ctx.fillStyle = dark ? '#ffffff' : '#1c1c1e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1, 440);
  ctx.restore();
}

const MODE_BADGE: Record<TransportMode, string> = {
  car: '#0a84ff', motorcycle: '#5e5ce6', plane: '#ff375f', ship: '#30b0c7', train: '#ff9f0a', bike: '#30d158', walk: '#a2845e', bus: '#bf5af2',
};

/** Eigene, einfache Vektorsymbole (keine Drittanbieter-Assets). Glyph aufrecht, Richtungspfeil rotiert. */
export function drawVehicle(ctx: CanvasRenderingContext2D, mode: TransportMode, x: number, y: number, rot: number, color: string) {
  const R = 20;
  ctx.save();
  ctx.translate(x, y);
  // Richtungspfeil
  ctx.save();
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -R - 11);
  ctx.lineTo(7, -R - 1);
  ctx.lineTo(-7, -R - 1);
  ctx.closePath();
  ctx.fillStyle = MODE_BADGE[mode];
  ctx.fill();
  ctx.restore();
  // Badge
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = MODE_BADGE[mode];
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.translate(-12, -12);
  if (mode === 'plane') {
    ctx.translate(12, 12);
    ctx.rotate(rot);
    ctx.translate(-12, -12);
  }
  glyph(ctx, mode);
  ctx.restore();
}

function glyph(ctx: CanvasRenderingContext2D, mode: TransportMode) {
  const circle = (cx: number, cy: number, r: number, fill = true) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (fill) ctx.fill();
    else ctx.stroke();
  };
  const poly = (pts: number[]) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) (i ? ctx.lineTo(pts[i]!, pts[i + 1]!) : ctx.moveTo(pts[i]!, pts[i + 1]!));
    ctx.closePath();
    ctx.fill();
  };
  switch (mode) {
    case 'plane':
      poly([12, 2, 13.6, 9, 21, 13, 21, 15, 13.6, 12.8, 13.2, 18, 15.6, 20, 15.6, 21.6, 12, 20.6, 8.4, 21.6, 8.4, 20, 10.8, 18, 10.4, 12.8, 3, 15, 3, 13, 10.4, 9]);
      break;
    case 'car':
      poly([4, 14, 6.5, 8.5, 17.5, 8.5, 20, 14, 20, 17.5, 4, 17.5]);
      circle(7.5, 18, 2);
      circle(16.5, 18, 2);
      break;
    case 'motorcycle':
      circle(6, 16, 3.2, false);
      circle(18, 16, 3.2, false);
      poly([6, 16, 10, 10, 15, 10, 18, 16, 16, 16, 13.5, 12, 10, 12, 7.5, 16]);
      break;
    case 'ship':
      poly([3, 13.5, 21, 13.5, 18, 19, 6, 19]);
      poly([8, 8.5, 16, 8.5, 16, 13, 8, 13]);
      poly([11, 5, 13, 5, 13, 8.5, 11, 8.5]);
      break;
    case 'train':
      ctx.beginPath();
      ctx.roundRect(6, 3.5, 12, 14, 3);
      ctx.fill();
      circle(9, 20, 1.6);
      circle(15, 20, 1.6);
      break;
    case 'bus':
      ctx.beginPath();
      ctx.roundRect(4, 5, 16, 12.5, 2.5);
      ctx.fill();
      circle(8, 18.5, 1.8);
      circle(16, 18.5, 1.8);
      break;
    case 'bike':
      circle(6, 15, 3.6, false);
      circle(18, 15, 3.6, false);
      ctx.beginPath();
      ctx.moveTo(6, 15); ctx.lineTo(10, 9); ctx.lineTo(15, 9); ctx.lineTo(18, 15); ctx.moveTo(10, 9); ctx.lineTo(12.5, 15); ctx.lineTo(15, 9);
      ctx.stroke();
      break;
    case 'walk':
      circle(12, 4.5, 2.3);
      ctx.beginPath();
      ctx.lineWidth = 2.4;
      ctx.moveTo(12, 8); ctx.lineTo(11, 14); ctx.lineTo(8, 20); ctx.moveTo(11, 14); ctx.lineTo(15, 20); ctx.moveTo(8, 11); ctx.lineTo(16, 11);
      ctx.stroke();
      break;
  }
}
