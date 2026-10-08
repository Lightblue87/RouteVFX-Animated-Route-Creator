import { useEffect, useRef, useState } from 'react';
import { useI18n } from './App';
import type { Project } from '../core/project/schema';
import { probeCapabilities, suggestProfile, type DeviceCapabilities } from '../adapters/encoding/capabilities';
import { exportMp4, ExportError, type ExportProgress, type ExportResult } from '../adapters/encoding/mp4Export';
import { EXPORT_PROFILES, type ExportProfileId } from '../core/types';
import { getBlob } from '../adapters/storage/idb';
import { renderAudioMix } from '../features/export/audio';
import { planTimeline } from '../core/timeline';

export function ExportPanel({ project }: { project: Project }) {
  const { t, locale } = useI18n();
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null);
  const [profile, setProfile] = useState<ExportProfileId>(project.exportProfile);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<(ExportResult & { url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void probeCapabilities().then((c) => {
      setCaps(c);
      const s = suggestProfile(c.profiles, project.exportProfile);
      if (s) setProfile(s);
    });
    return () => abortRef.current?.abort();
  }, [project.exportProfile]);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const hasRoute = project.journey.segments.length > 0;
  const cap = caps?.profiles.find((c) => c.profile === profile);
  const p = EXPORT_PROFILES[profile];
  const frames = Math.round((planTimeline(project).totalMs / 1000) * p.fps);
  const wantsAudio = !!project.audio && !project.audio.muted;

  const start = async () => {
    setError(null);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      let audio: AudioBuffer | null = null;
      if (wantsAudio && caps?.aac) {
        const stored = await getBlob(project.audio!.assetId);
        if (stored) audio = await renderAudioMix(stored.blob, project.audio!, project.targetDurationMs);
      }
      const r = await exportMp4({ project, profile, locale, audio, signal: ac.signal, onProgress: setProgress });
      setResult({ ...r, url: URL.createObjectURL(r.blob) });
    } catch (e) {
      const code = e instanceof ExportError ? e.code : 'unknown';
      setError(code === 'canceled' ? t('export.canceled') : code === 'background' ? t('export.background') : t('export.failed', { code }));
      // Diagnose ohne Projektinhalte
      console.warn('export_error', code, (e as Error).message?.slice(0, 200));
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const fileName = `${(project.title || 'route').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40)}_${profile}.mp4`;
  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], fileName, { type: 'video/mp4' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: project.title || undefined });
      } catch { /* Nutzer hat abgebrochen */ }
    }
  };
  const canShareFiles = (() => {
    try {
      return !!result && !!navigator.canShare?.({ files: [new File([new Blob()], 'x.mp4', { type: 'video/mp4' })] });
    } catch {
      return false;
    }
  })();

  return (
    <div className="panel export-panel sheet">
      {!hasRoute && <p className="warn">{t('export.noRoute')}</p>}
      {!caps && <p className="muted" aria-busy="true">{t('export.probe')}</p>}
      {caps && (
        <fieldset className="seg-control">
          <legend>{t('export.profile')}</legend>
          {caps.profiles.map((c) => (
            <label key={c.profile} className={c.available ? '' : 'disabled'}>
              <input type="radio" name="profile" disabled={!c.available || !!progress} checked={profile === c.profile} onChange={() => setProfile(c.profile)} data-testid={`profile-${c.profile}`} />
              {c.profile}
              {!c.available && <span className="small muted"> – {t('export.unavailable', { reason: c.reason ?? '?' })}</span>}
            </label>
          ))}
        </fieldset>
      )}
      {caps && !cap?.available && (() => {
        const s = suggestProfile(caps.profiles, '4k60');
        return s ? <p className="small">{t('export.suggestLower', { profile: s })}</p> : null;
      })()}
      <p className="small muted">{t('export.estimate', { frames, s: (frames / p.fps).toFixed(1) })} · {t('export.untested')}</p>
      {profile.startsWith('4k') && <p className="small warn">{t('export.memoryWarn')}</p>}
      {wantsAudio && caps && !caps.aac && <p className="small warn">{t('export.noAac')}</p>}
      <p className="small muted">{t('export.keepOpen')}</p>
      {!progress ? (
        <button className="btn primary big" disabled={!hasRoute || !cap?.available} onClick={start} data-testid="export-start">{t('export.start')}</button>
      ) : (
        <>
          <progress max={progress.frames} value={progress.frame} aria-label="export progress" />
          <p className="small" aria-live="polite" data-testid="export-progress">
            {progress.phase === 'render' ? t('export.progress', { i: progress.frame, n: progress.frames }) : progress.phase === 'prepare' ? t('export.prepare') : t('export.finalizing')}
          </p>
          <button className="btn danger" onClick={() => abortRef.current?.abort()} data-testid="export-cancel">{t('export.cancel')}</button>
        </>
      )}
      {error && <p className="error" role="alert" data-testid="export-error">{error}</p>}
      {result && (
        <div className="card result" data-testid="export-result">
          <video src={result.url} controls playsInline className="result-video" />
          <p className="small" data-testid="export-summary">
            {t('export.done', { size: `${(result.blob.size / 1e6).toFixed(1)} MB`, codec: result.mimeType })} · {result.verified.width}×{result.verified.height} · {result.verified.fps} fps · {result.verified.durationS.toFixed(2)} s · {(result.renderMs / 1000).toFixed(1)} s Renderzeit
          </p>
          <div className="row">
            <a className="btn primary" href={result.url} download={fileName} data-testid="export-download">{t('export.save')}</a>
            {canShareFiles && <button className="btn" onClick={share}>{t('export.share')}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
