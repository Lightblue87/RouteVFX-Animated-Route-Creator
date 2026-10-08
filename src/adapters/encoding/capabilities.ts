import { canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { EXPORT_PROFILES, type ExportCapability, type ExportProfileId } from '../../core/types';

export const VIDEO_BITRATE: Record<ExportProfileId, number> = {
  '1080p30': 12_000_000,
  '1080p60': 16_000_000,
  '4k30': 35_000_000,
  '4k60': 50_000_000,
};

export interface DeviceCapabilities {
  profiles: ExportCapability[];
  aac: boolean;
  webgl2: boolean;
  maxRenderbuffer: number;
  share: boolean;
  deviceMemoryGb?: number;
}

/** Größte WebGL-Renderbuffergröße – Voraussetzung für 4K-Kartenframes. */
function probeWebgl(): { ok: boolean; maxRenderbuffer: number } {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return { ok: false, maxRenderbuffer: 0 };
    const max = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, maxRenderbuffer: max };
  } catch {
    return { ok: false, maxRenderbuffer: 0 };
  }
}

/**
 * Echte Feature-Detection (keine UA-Vermutung): fragt den Encoder je Profil ab.
 * Ein "available" bedeutet: Konfiguration wird akzeptiert – NICHT, dass ein 3-Minuten-Export
 * auf diesem Gerät thermisch/speicherseitig gelingt (siehe E09).
 */
export async function probeCapabilities(): Promise<DeviceCapabilities> {
  const gl = probeWebgl();
  const hasWebCodecs = typeof VideoEncoder !== 'undefined';
  const deviceMemoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const profiles: ExportCapability[] = [];
  for (const p of Object.values(EXPORT_PROFILES)) {
    if (!hasWebCodecs) {
      profiles.push({ profile: p.id, available: false, reason: 'no_webcodecs' });
      continue;
    }
    if (!gl.ok) {
      profiles.push({ profile: p.id, available: false, reason: 'no_webgl2' });
      continue;
    }
    if (gl.maxRenderbuffer < p.height) {
      profiles.push({ profile: p.id, available: false, reason: 'gpu_too_small' });
      continue;
    }
    let ok = false;
    try {
      ok = await canEncodeVideo('avc', { width: p.width, height: p.height, frameRate: p.fps, bitrate: VIDEO_BITRATE[p.id] });
    } catch {
      ok = false;
    }
    profiles.push(ok ? { profile: p.id, available: true } : { profile: p.id, available: false, reason: 'h264_unsupported' });
  }
  let aac = false;
  try {
    aac = hasWebCodecs && (await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48_000, bitrate: 192_000 }));
  } catch {
    aac = false;
  }
  const share = typeof navigator.canShare === 'function';
  return { profiles, aac, webgl2: gl.ok, maxRenderbuffer: gl.maxRenderbuffer, share, deviceMemoryGb };
}

/** Höchstes verfügbares Profil, das nicht über dem Wunschprofil liegt (Fallback-Kette 4k60→4k30→1080p60→1080p30). */
export function suggestProfile(caps: ExportCapability[], wanted: ExportProfileId): ExportProfileId | null {
  const order: ExportProfileId[] = ['4k60', '4k30', '1080p60', '1080p30'];
  const start = order.indexOf(wanted);
  for (const id of order.slice(start)) if (caps.find((c) => c.profile === id)?.available) return id;
  return null;
}
