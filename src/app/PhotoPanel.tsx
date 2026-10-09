import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from './App';
import type { ProjectApi } from './Editor';
import { buildSceneModel } from '../core/scene/evaluate';
import { MAX_PHOTOS, PHOTO_HOLD_MAX_MS, PHOTO_HOLD_MIN_MS, type Photo } from '../core/project/schema';
import { newId } from '../core/project/factory';
import { getBlob, putBlob, StorageError } from '../adapters/storage/idb';
import { PhotoError, preparePhoto } from '../features/photos/image';
import type { MessageKey } from '../i18n';

const FAR_WARN_M = 20_000;
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);

function Thumb({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    void getBlob(assetId).then((b) => {
      if (!alive || !b) return;
      revoked = URL.createObjectURL(b.blob);
      setUrl(revoked);
    });
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [assetId]);
  return url ? <img className="photo-thumb" src={url} alt="" /> : <div className="photo-thumb" aria-hidden="true" />;
}

/**
 * Fotos zur Route: Auswahl vom Gerät, Ort aus dem Geo-Tag (falls vorhanden) oder vom Nutzer per Tipp auf die Karte.
 * Alles lokal; gespeichert wird nur eine verkleinerte, metadatenfreie Kopie.
 */
export function PhotoPanel({ api, picking, onPick }: { api: ProjectApi; picking: string | null; onPick: (photoId: string | null) => void }) {
  const { t } = useI18n();
  const { project, commit } = api;
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = project.photos.length >= MAX_PHOTOS;

  const model = useMemo(() => buildSceneModel(project), [project]);

  const addFiles = async (files: File[]) => {
    setMessage(null);
    setBusy(true);
    let added = 0;
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (project.photos.length + added >= MAX_PHOTOS) break;
        try {
          const prepared = await preparePhoto(file);
          const assetId = newId();
          await putBlob({ id: assetId, projectId: project.id, name: clean(file.name), type: 'image/jpeg', size: prepared.blob.size, blob: prepared.blob });
          const photo: Photo = {
            id: newId(),
            assetId,
            fileName: clean(file.name),
            width: prepared.width,
            height: prepared.height,
            position: prepared.gps ? { lat: prepared.gps.lat, lon: prepared.gps.lon } : null,
            positionSource: prepared.gps ? 'exif' : null,
            caption: '',
            holdMs: 2500,
          };
          commit((p) => (p.photos.length >= MAX_PHOTOS ? p : { ...p, modifiedAt: new Date().toISOString(), photos: [...p.photos, photo] }));
          added++;
        } catch (e) {
          if (e instanceof PhotoError) errors.push(t(`photos.err.${e.code}` as MessageKey));
          else if (e instanceof StorageError && e.code === 'quota') errors.push(t('photos.err.quota'));
          else errors.push(t('photos.err.decode_failed'));
        }
      }
    } finally {
      setBusy(false);
    }
    setMessage([added > 0 ? t('photos.imported', { n: added }) : '', ...new Set(errors)].filter(Boolean).join(' '));
  };

  const update = (id: string, patch: Partial<Photo>) =>
    commit((p) => ({ ...p, modifiedAt: new Date().toISOString(), photos: p.photos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  return (
    <section className="card" data-testid="photo-panel">
      <h3>{t('photos.title')} <span className="muted small">{project.photos.length}/{MAX_PHOTOS}</span></h3>
      <p className="small muted">{t('photos.note')}</p>
      <p className="small muted">{t('photos.iosHint')}</p>
      <div className="row wrap">
        <button className="btn small" onClick={() => fileRef.current?.click()} disabled={busy || full} data-testid="photo-add">{t('photos.add')}</button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden data-testid="photo-input"
          onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) void addFiles(f); }} />
        {full && <span className="small muted">{t('photos.limit', { n: MAX_PHOTOS })}</span>}
      </div>
      {message && <p className="small" role="status" data-testid="photo-message">{message}</p>}
      {picking && (
        <div className="row small" role="status">
          <span className="grow">{t('photos.pickHint')}</span>
          <button className="btn small" onClick={() => onPick(null)} data-testid="photo-pick-cancel">{t('photos.pickCancel')}</button>
        </div>
      )}
      <ul className="list">
        {project.photos.map((ph) => {
          const moment = model.photoMoments.find((m) => m.photoId === ph.id);
          const far = moment && moment.distanceToRouteM > FAR_WARN_M ? Math.round(moment.distanceToRouteM / 1000) : null;
          return (
            <li key={ph.id} className="photo-row" data-testid="photo-item">
              <Thumb assetId={ph.assetId} />
              <div className="photo-meta">
                <span className="small" data-testid="photo-source">
                  {ph.positionSource === 'exif' ? t('photos.posExif') : ph.positionSource === 'manual' ? t('photos.posManual') : t('photos.posNone')}
                </span>
                {moment && <span className="small muted">{t('photos.at', { s: (moment.startMs / 1000).toFixed(1) })}</span>}
                {far !== null && <span className="small warn">{t('photos.far', { km: far })}</span>}
                <input type="text" maxLength={80} value={ph.caption} placeholder={t('photos.caption')} aria-label={t('photos.caption')}
                  onChange={(e) => update(ph.id, { caption: e.target.value })} />
                <div className="row wrap">
                  <label className="small">{t('photos.hold')}
                    <input type="number" min={PHOTO_HOLD_MIN_MS / 1000} max={PHOTO_HOLD_MAX_MS / 1000} step={0.5} value={ph.holdMs / 1000}
                      onChange={(e) => {
                        const v = e.target.valueAsNumber;
                        if (Number.isFinite(v)) update(ph.id, { holdMs: Math.round(Math.min(PHOTO_HOLD_MAX_MS, Math.max(PHOTO_HOLD_MIN_MS, v * 1000))) });
                      }} />
                  </label>
                  <button className="btn small" aria-pressed={picking === ph.id} onClick={() => onPick(picking === ph.id ? null : ph.id)} data-testid="photo-pick">
                    {ph.position ? t('photos.changePoint') : t('photos.setPoint')}
                  </button>
                  <button className="btn small danger" onClick={() => { if (picking === ph.id) onPick(null); commit((p) => ({ ...p, modifiedAt: new Date().toISOString(), photos: p.photos.filter((x) => x.id !== ph.id) })); }} data-testid="photo-remove">
                    {t('photos.remove')}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
