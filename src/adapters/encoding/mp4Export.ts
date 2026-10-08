import { ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, CanvasSource, Input, Mp4OutputFormat, Output } from 'mediabunny';
import { buildSceneModel, evaluateScene } from '../../core/scene/evaluate';
import type { Project } from '../../core/project/schema';
import { EXPORT_PROFILES, type ExportProfileId } from '../../core/types';
import { MapLibreSceneRenderer } from '../maps/maplibreRenderer';
import { getStyleInfo } from '../maps/styles';
import { VIDEO_BITRATE } from './capabilities';
import type { Locale } from '../../i18n';

export class ExportError extends Error {
  constructor(public readonly code: 'canceled' | 'background' | 'render_failed' | 'encode_failed' | 'verify_failed' | 'no_route', message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

export interface ExportProgress {
  phase: 'prepare' | 'render' | 'finalize' | 'verify';
  frame: number;
  frames: number;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  frames: number;
  /** Aus der fertigen Datei zurückgelesene Werte (Integritätsprüfung). */
  verified: { durationS: number; width: number; height: number; videoCodec: string | null; audioCodec: string | null; fps: number };
  warnings: string[];
  renderMs: number;
}

export interface ExportRequest {
  project: Project;
  profile: ExportProfileId;
  locale: Locale;
  audio?: AudioBuffer | null;
  signal?: AbortSignal;
  onProgress?: (p: ExportProgress) => void;
}

/**
 * Clientseitiger MP4-Export (Stufe a): deterministische Frames → WebCodecs H.264 → MP4 (mediabunny).
 * Begrenzter Puffer: jeweils genau ein Frame; Encoder-Backpressure über await source.add().
 * Bekannte Grenze: BufferTarget hält die fertige Datei im Speicher (siehe RISKS.md R-07).
 */
export async function exportMp4(req: ExportRequest): Promise<ExportResult> {
  const { project, signal } = req;
  if (project.journey.segments.length === 0) throw new ExportError('no_route', 'no segments');
  const profile = EXPORT_PROFILES[req.profile];
  const model = buildSceneModel(project);
  const fps = profile.fps;
  const frames = Math.max(1, Math.round((model.plan.totalMs / 1000) * fps));
  const warnings: string[] = [];
  const started = performance.now();

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const styleInfo = getStyleInfo(project.mapStyleRef);
  const renderer = new MapLibreSceneRenderer({
    container: host,
    styleId: styleInfo.exportAllowed ? styleInfo.id : 'ne-light',
    pixelRatio: profile.width / 540,
    interactive: false,
    forCapture: true,
  });
  const canvas = document.createElement('canvas');
  canvas.width = profile.width;
  canvas.height = profile.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  let backgrounded = false;
  const onVis = () => {
    if (document.visibilityState === 'hidden') backgrounded = true;
  };
  document.addEventListener('visibilitychange', onVis);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  try {
    req.onProgress?.({ phase: 'prepare', frame: 0, frames });
    await renderer.whenReady();
    console.debug('[export] map ready');
    const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: VIDEO_BITRATE[req.profile], keyFrameInterval: 2 });
    output.addVideoTrack(videoSource, { frameRate: fps });
    let audioSource: AudioBufferSource | null = null;
    if (req.audio) {
      audioSource = new AudioBufferSource({ codec: 'aac', bitrate: 192_000 });
      output.addAudioTrack(audioSource);
    }
    await output.start();
    console.debug('[export] output started');
    if (audioSource && req.audio) {
      await audioSource.add(req.audio);
      audioSource.close();
    }

    const attributions = new Set([styleInfo.attribution]);
    for (const s of project.journey.segments) if (s.attribution) attributions.add(s.attribution);
    const overlay = {
      locale: req.locale,
      overlays: project.overlays,
      vehicleColor: project.vehicleColor,
      attribution: [...attributions].join(' · '),
      dark: styleInfo.variant === 'dark',
    };

    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw new ExportError('canceled', 'canceled');
      if (backgrounded) throw new ExportError('background', 'page hidden');
      const tMs = (i * 1000) / fps;
      const state = evaluateScene(model, tMs);
      try {
        await renderer.renderCamera(state.camera);
      } catch (e) {
        throw new ExportError('render_failed', (e as Error).message);
      }
      if (i === 0) console.debug('[export] first frame rendered');
      renderer.composite(ctx, state, overlay);
      try {
        await videoSource.add(i / fps, 1 / fps);
      } catch (e) {
        throw new ExportError('encode_failed', (e as Error).message);
      }
      req.onProgress?.({ phase: 'render', frame: i + 1, frames });
    }
    videoSource.close();
    req.onProgress?.({ phase: 'finalize', frame: frames, frames });
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new ExportError('encode_failed', 'empty output');
    const mimeType = await output.getMimeType();
    const blob = new Blob([buffer], { type: 'video/mp4' });

    req.onProgress?.({ phase: 'verify', frame: frames, frames });
    const verified = await verifyMp4(blob);
    const expectedS = frames / fps;
    if (Math.abs(verified.durationS - expectedS) > 0.2 || verified.width !== profile.width || verified.height !== profile.height || verified.videoCodec !== 'avc') {
      throw new ExportError('verify_failed', `verify mismatch ${JSON.stringify(verified)}`);
    }
    return { blob, mimeType, frames, verified, warnings, renderMs: performance.now() - started };
  } catch (e) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined);
    if (e instanceof ExportError) throw e;
    throw new ExportError('encode_failed', (e as Error)?.message ?? String(e));
  } finally {
    document.removeEventListener('visibilitychange', onVis);
    renderer.dispose();
    host.remove();
  }
}

/** Liest die fertige Datei zurück: Dauer, Auflösung, Codecs, mittlere Framerate. */
export async function verifyMp4(blob: Blob): Promise<ExportResult['verified']> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    const at = await input.getPrimaryAudioTrack();
    if (!vt) throw new ExportError('verify_failed', 'no video track');
    const durationS = await input.computeDuration();
    const stats = await vt.computePacketStats();
    return {
      durationS,
      width: vt.displayWidth,
      height: vt.displayHeight,
      videoCodec: vt.codec,
      audioCodec: at?.codec ?? null,
      fps: Math.round(stats.averagePacketRate * 100) / 100,
    };
  } finally {
    input.dispose?.();
  }
}
