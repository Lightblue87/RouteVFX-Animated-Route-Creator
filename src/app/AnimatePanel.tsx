import { useRef, useState } from 'react';
import { useI18n } from './App';
import type { ProjectApi } from './Editor';
import { Preview } from './Preview';
import { MAP_STYLES } from '../adapters/maps/styles';
import { updateSegment } from '../features/projects/journey';
import { planTimeline } from '../core/timeline';
import { putBlob } from '../adapters/storage/idb';
import { newId } from '../core/project/factory';
import { AUDIO_MAX_BYTES } from '../features/export/audio';
import type { Project } from '../core/project/schema';

export function AnimatePanel({ api }: { api: ProjectApi }) {
  const { t } = useI18n();
  const { project, commit } = api;
  const set = (patch: Partial<Project>) => commit((p) => ({ ...p, ...patch, modifiedAt: new Date().toISOString() }));
  const plan = planTimeline(project);
  const audioRef = useRef<HTMLInputElement>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const pickAudio = async (f: File) => {
    setAudioError(null);
    if (f.size > AUDIO_MAX_BYTES || !f.type.startsWith('audio/')) {
      setAudioError('audio_invalid');
      return;
    }
    const id = newId();
    await putBlob({ id, projectId: project.id, name: f.name.slice(0, 200), type: f.type, size: f.size, blob: f });
    set({ audio: { assetId: id, fileName: f.name.slice(0, 200), gain: 1, fadeInMs: 1000, fadeOutMs: 2000, muted: false } });
  };

  return (
    <div className="panel animate-panel">
      <Preview project={project} />
      <div className="sheet">
        <label className="field">
          {t('anim.title')}
          <input value={project.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} data-testid="title-input" />
        </label>
        <label className="field">
          {t('anim.duration', { s: (project.targetDurationMs / 1000).toFixed(0) })}
          <input type="range" min={3} max={180} step={1} value={Math.round(project.targetDurationMs / 1000)}
            onChange={(e) => set({ targetDurationMs: Number(e.target.value) * 1000 })} data-testid="duration" />
        </label>
        <fieldset className="seg-control">
          <legend>{t('anim.timeMode')}</legend>
          {(['cinematic', 'proportional'] as const).map((m) => (
            <label key={m}><input type="radio" name="tm" checked={project.timeMode === m} onChange={() => set({ timeMode: m })} />{t(`anim.${m}`)}</label>
          ))}
        </fieldset>
        {project.timeMode === 'proportional' && plan.estimatedTiming.some(Boolean) && <p className="small warn">{t('anim.estimatedTiming')}</p>}
        <fieldset className="seg-control">
          <legend>{t('anim.camera')}</legend>
          {(['overview', 'follow', 'follow-rotate'] as const).map((m) => (
            <label key={m}><input type="radio" name="cam" checked={project.cameraPreset === m} onChange={() => set({ cameraPreset: m })} />{t(`anim.cam.${m}`)}</label>
          ))}
        </fieldset>
        <label className="field">
          {t('anim.style')}
          <select value={project.mapStyleRef} onChange={(e) => set({ mapStyleRef: e.target.value })}>
            {MAP_STYLES.map((s) => <option key={s.id} value={s.id}>{s.provider} – {s.variant}</option>)}
          </select>
        </label>
        {project.journey.segments.map((s, i) => (
          <div key={s.id} className="card">
            <strong className="small">{t('route.segment', { n: i + 1 })} · {t(`mode.${s.mode}`)}</strong>
            <div className="row wrap">
              <select value={s.lineStyle.kind} aria-label={t('anim.lineStyle')}
                onChange={(e) => commit((p) => updateSegment(p, s.id, { lineStyle: { ...s.lineStyle, kind: e.target.value as 'progressive' | 'full' | 'dashed' } }))}>
                {(['progressive', 'full', 'dashed'] as const).map((k) => <option key={k} value={k}>{t(`anim.line.${k}`)}</option>)}
              </select>
              <input type="color" value={s.lineStyle.color} aria-label="color"
                onChange={(e) => commit((p) => updateSegment(p, s.id, { lineStyle: { ...s.lineStyle, color: e.target.value } }))} />
              <label className="small">
                {t('anim.segmentDuration', { n: i + 1 })}
                <input type="number" min={0.2} max={180} step={0.1} value={s.manualDurationMs ? s.manualDurationMs / 1000 : ''}
                  onChange={(e) => commit((p) => updateSegment(p, s.id, { manualDurationMs: e.target.value ? Math.max(200, Math.round(Number(e.target.value) * 1000)) : undefined }))} />
              </label>
            </div>
          </div>
        ))}
        <fieldset>
          <legend>{t('anim.overlays')}</legend>
          {(Object.keys(project.overlays) as (keyof Project['overlays'])[]).map((k) => (
            <label key={k} className="toggle">
              <input type="checkbox" checked={project.overlays[k]}
                onChange={(e) => {
                  if (k === 'showEstimateNotice' && !e.target.checked && !confirm(t('anim.removeNoticeConfirm'))) return;
                  set({ overlays: { ...project.overlays, [k]: e.target.checked } });
                }} />
              {t(`anim.ov.${k}`)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('anim.audio')}</legend>
          <p className="small muted">{t('anim.audioNote')}</p>
          {project.audio ? (
            <>
              <p className="small">{project.audio.fileName}</p>
              <label className="field small">{t('anim.gain')}
                <input type="range" min={0} max={2} step={0.05} value={project.audio.gain} onChange={(e) => set({ audio: { ...project.audio!, gain: Number(e.target.value) } })} />
              </label>
              <label className="field small">{t('anim.fadeIn')}
                <input type="number" min={0} max={20} step={0.5} value={project.audio.fadeInMs / 1000} onChange={(e) => set({ audio: { ...project.audio!, fadeInMs: Math.round(Number(e.target.value) * 1000) } })} />
              </label>
              <label className="field small">{t('anim.fadeOut')}
                <input type="number" min={0} max={20} step={0.5} value={project.audio.fadeOutMs / 1000} onChange={(e) => set({ audio: { ...project.audio!, fadeOutMs: Math.round(Number(e.target.value) * 1000) } })} />
              </label>
              <label className="toggle small"><input type="checkbox" checked={project.audio.muted} onChange={(e) => set({ audio: { ...project.audio!, muted: e.target.checked } })} />{t('anim.muted')}</label>
              <button className="btn small danger" onClick={() => set({ audio: undefined })}>{t('anim.audioRemove')}</button>
            </>
          ) : (
            <button className="btn small" onClick={() => audioRef.current?.click()}>{t('anim.audioPick')}</button>
          )}
          <input ref={audioRef} type="file" accept="audio/*" hidden data-testid="audio-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickAudio(f); e.target.value = ''; }} />
          {audioError && <p className="small error">{audioError}</p>}
        </fieldset>
      </div>
    </div>
  );
}
