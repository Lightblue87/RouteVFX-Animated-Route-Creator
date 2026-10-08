import type { AudioSettings } from '../../core/project/schema';

export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
export const AUDIO_SAMPLE_RATE = 48_000;

/**
 * Mischt die Musikdatei offline auf exakt die Videodauer: Gain, Fade-in/-out, Stummschaltung.
 * Deterministisch (OfflineAudioContext), keine Netzwerkzugriffe.
 */
export async function renderAudioMix(file: Blob, settings: AudioSettings, durationMs: number): Promise<AudioBuffer | null> {
  if (settings.muted) return null;
  if (file.size > AUDIO_MAX_BYTES) throw new Error('audio_too_large');
  const length = Math.max(1, Math.round((durationMs / 1000) * AUDIO_SAMPLE_RATE));
  const ctx = new OfflineAudioContext(2, length, AUDIO_SAMPLE_RATE);
  const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  const src = ctx.createBufferSource();
  src.buffer = decoded;
  const gain = ctx.createGain();
  const dur = durationMs / 1000;
  const fadeIn = Math.min(settings.fadeInMs / 1000, dur / 2);
  const fadeOut = Math.min(settings.fadeOutMs / 1000, dur / 2);
  gain.gain.setValueAtTime(fadeIn > 0 ? 0 : settings.gain, 0);
  if (fadeIn > 0) gain.gain.linearRampToValueAtTime(settings.gain, fadeIn);
  gain.gain.setValueAtTime(settings.gain, Math.max(fadeIn, dur - fadeOut));
  if (fadeOut > 0) gain.gain.linearRampToValueAtTime(0, dur);
  src.connect(gain).connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}
