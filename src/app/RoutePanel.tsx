import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from './App';
import type { ProjectApi } from './Editor';
import { PlannerMap } from './PlannerMap';
import { loadAirports, loadPlaces, searchNominatim, searchOffline, type Place } from '../adapters/geocoding';
import { createOnlineRoutingProvider } from '../adapters/routing/config';
import type { RoutingSettings } from '../adapters/routing/registry';
import { addStop, applyControlPoints, appendGpxTrack, controlPointsOf, changeSegmentMode, LatestRequestGate, markOnlineUsed, fillMissingSegments, missingPairs, moveStop, normalizeSegments, replaceSegmentIfUnchanged, removeStop, updateSegment, updateStop } from '../features/projects/journey';
import { GPX_MAX_BYTES, GpxError, parseGpx } from '../features/imports/gpx';
import type { RouteSegment } from '../core/project/schema';
import { TRANSPORT_MODES, type GeoPoint, type TransportMode } from '../core/types';
import { formatKm, type MessageKey } from '../i18n';

const ONLINE_KEY = 'arc.onlineAllowed';
const onlineRouting = createOnlineRoutingProvider();
const ROUTER_NAME = onlineRouting.id === 'ors-proxy' ? 'openrouteservice (HeiGIT) · Supabase' : 'FOSSGIS-OSRM';

export function useOnlineSetting(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try { return localStorage.getItem(ONLINE_KEY) === '1'; } catch { return false; }
  });
  return [v, (n: boolean) => {
    setV(n);
    try { localStorage.setItem(ONLINE_KEY, n ? '1' : '0'); } catch { /* ignore */ }
  }];
}

export function RoutePanel({ api }: { api: ProjectApi }) {
  const { t, locale } = useI18n();
  const { project, commit, commitDerived } = api;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnlineState] = useOnlineSetting();
  // Aktuelle Einwilligung, auch für laufende Sammelberechnungen: ein Widerruf stoppt weitere Übertragungen sofort.
  const consent = useRef(online);
  const setOnline = (v: boolean) => {
    consent.current = v;
    setOnlineState(v);
  };
  const settings: RoutingSettings = useMemo(() => ({ onlineAllowed: online, online: onlineRouting }), [online]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const editSeg = project.journey.segments.find((s) => s.id === editId) ?? null;
  const edit = editSeg
    ? {
        segmentId: editSeg.id,
        points: controlPointsOf(editSeg),
        onChange: (pts: GeoPoint[]) => commit((p) => ({ ...p, modifiedAt: new Date().toISOString(), journey: { ...p.journey, segments: p.journey.segments.map((s) => (s.id === editSeg.id ? applyControlPoints(s, pts) : s)) } })),
      }
    : null;

  // Offline-Suche (lokal, ohne Netz) mit leichtem Debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(async () => {
      const [places, airports] = await Promise.all([loadPlaces(), loadAirports()]);
      setResults(searchOffline(places, airports, query));
    }, 150);
    return () => clearTimeout(h);
  }, [query]);

  // Fehlende Segmente nach Stopp-Änderungen berechnen
  const pending = useRef(false);
  useEffect(() => {
    const orphan = project.journey.segments.length > Math.max(0, project.journey.stops.length - 1);
    if (orphan && missingPairs(project).length === 0) {
      commitDerived((cur) => normalizeSegments(cur));
      return;
    }
    if (missingPairs(project).length === 0 || pending.current) return;
    pending.current = true;
    setBusy(true);
    fillMissingSegments(project, settings)
      .then(({ project: p, notices: n }) => {
        // In den aktuellen Zustand einmischen (Nutzer kann während der Berechnung weiter editieren).
        const fresh = p.journey.segments.filter((s) => !project.journey.segments.includes(s));
        commitDerived((cur) =>
          normalizeSegments({
            ...cur,
            privacy: p.privacy.usedOnlineServices ? { usedOnlineServices: true } : cur.privacy,
            journey: { ...cur.journey, segments: [...cur.journey.segments, ...fresh.filter((f) => !cur.journey.segments.some((c) => c.fromStopId === f.fromStopId && c.toStopId === f.toStopId))] },
          }),
        );
        setNotices(n);
      })
      .finally(() => {
        pending.current = false;
        setBusy(false);
      });
  }, [project, settings, commit]);

  const add = (point: GeoPoint, label: string) => {
    commit((p) => addStop(p, point, label));
    setQuery('');
    setResults([]);
  };

  const onlineSearch = async () => {
    if (!online || query.trim().length < 2) return;
    setBusy(true);
    try {
      setResults(await searchNominatim(query, locale));
      commit((p) => ({ ...p, privacy: { usedOnlineServices: true } }));
    } catch (e) {
      setMessage(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const importGpx = async (file: File) => {
    setMessage(null);
    if (file.size > GPX_MAX_BYTES) {
      setMessage(t('route.gpxError', { reason: 'too_large' }));
      return;
    }
    try {
      const res = parseGpx(await file.text(), file.size);
      let tracks = res.tracks;
      if (!tracks.length && res.waypoints.length >= 2) {
        // Nur Wegpunkte: als Stopps übernehmen, Segmente werden berechnet/geschätzt
        commit((p) => res.waypoints.reduce((acc, w) => addStop(acc, w.point, w.name), p));
        tracks = [];
      }
      if (tracks.length) commit((p) => tracks.reduce((acc, tr) => appendGpxTrack(acc, tr), p));
      setMessage(t('route.gpxImported', { n: tracks.length }));
      setNotices(res.warnings);
    } catch (e) {
      setMessage(t('route.gpxError', { reason: e instanceof GpxError ? e.code : 'invalid' }));
    }
  };

  const modeGate = useRef(new LatestRequestGate()).current;
  const setMode = async (segId: string, mode: TransportMode) => {
    setBusy(true);
    const token = modeGate.begin(segId);
    try {
      const r = await changeSegmentMode(project, segId, mode, settings);
      if (!r) return;
      // Die Übertragung hat stattgefunden, auch wenn das Ergebnis gleich verworfen wird.
      if (r.usedOnline) commitDerived(markOnlineUsed);
      // Eine spätere Auswahl für denselben Abschnitt gewinnt, egal in welcher Reihenfolge die Antworten eintreffen.
      if (!modeGate.isLatest(segId, token)) return;
      commit((cur) => replaceSegmentIfUnchanged(cur, r.base, r.segment));
      setNotices(r.notices);
    } finally {
      modeGate.end(segId, token);
      setBusy(false);
    }
  };

  // Straßen-/Wegmodi, die nur als gerade Näherung vorliegen: Online-Routing nachholen (ausdrückliche Nutzeraktion).
  const ROAD_MODES: TransportMode[] = ['car', 'motorcycle', 'bike', 'walk'];
  const estimatedRoad = project.journey.segments.filter((s) => s.confidence === 'estimated' && ROAD_MODES.includes(s.mode) && onlineRouting.supportedModes.includes(s.mode));
  const recomputeRoads = async () => {
    if (pending.current || estimatedRoad.length === 0) return;
    pending.current = true;
    setBusy(true);
    try {
      const allowed: RoutingSettings = { onlineAllowed: true, online: onlineRouting };
      const done: { base: RouteSegment; segment: RouteSegment }[] = [];
      const all: string[] = [];
      let used = false;
      for (const seg of estimatedRoad) {
        if (!consent.current) break;
        const r = await changeSegmentMode(project, seg.id, seg.mode, allowed);
        if (!r) continue;
        used ||= r.usedOnline;
        all.push(...r.notices);
        // Gleiches Verkehrsmittel: Farbe/Linienart/Breite des Nutzers bleiben vollständig erhalten.
        done.push({ base: r.base, segment: { ...r.segment, lineStyle: r.base.lineStyle } });
      }
      if (used) commitDerived(markOnlineUsed);
      if (done.length) commit((cur) => done.reduce((acc, d) => replaceSegmentIfUnchanged(acc, d.base, d.segment), cur));
      setNotices(all);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const totalM = project.journey.segments.reduce((a, s) => a + s.distanceM, 0);

  return (
    <div className="panel route-panel">
      <PlannerMap project={project} edit={edit} onTap={(p) => add(p, `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`)} />
      {edit && (
        <div className="card row edit-bar" role="status">
          <span className="grow small">{t('route.editHint')}</span>
          <button className="btn primary small" onClick={() => setEditId(null)} data-testid="edit-done">{t('route.editDone')}</button>
        </div>
      )}
      <div className="sheet">
        <label className="search">
          <span className="sr-only">{t('route.search')}</span>
          <input
            type="search"
            value={query}
            placeholder={t('route.search')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onlineSearch()}
            data-testid="place-search"
            autoComplete="off"
          />
        </label>
        {online && <button className="btn small" onClick={onlineSearch} disabled={busy}>{t('route.searchOnline')}</button>}
        {results.length > 0 && (
          <ul className="results" role="listbox">
            {results.map((r, i) => (
              <li key={i}>
                <button className="link" onClick={() => add(r.point, r.name)} data-testid="place-result">
                  {r.name} <span className="muted small">{r.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {project.journey.stops.length === 0 && <p className="muted small">{t('route.addHint')}</p>}
        <div className="row wrap">
          <button className="btn small" onClick={() => fileRef.current?.click()}>{t('route.importGpx')}</button>
          <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden data-testid="gpx-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importGpx(f); e.target.value = ''; }} />
          <span className="badge">{t('route.offlineBadge')}</span>
          {busy && <span className="muted small" aria-live="polite">…</span>}
        </div>
        {message && <p className="small" role="status">{message}</p>}
        {notices.length > 0 && (
          <ul className="notices">
            {[...new Set(notices)].map((n) => <li key={n} className="small warn">{t(`warn.${n}` as MessageKey)}</li>)}
          </ul>
        )}
        <h3>{t('route.stops')} {totalM > 0 && <span className="muted small">{t('route.total', { km: formatKm(locale, totalM) })}</span>}</h3>
        <ol className="stops">
          {project.journey.stops.map((s, i) => {
            const seg = project.journey.segments.find((x) => x.fromStopId === s.id);
            return (
              <li key={s.id}>
                <div className="card stop">
                  <input className="grow" value={s.label} aria-label={`Stop ${i + 1}`} maxLength={80}
                    onChange={(e) => commit((p) => updateStop(p, s.id, { label: e.target.value }))} />
                  <button className="btn ghost icon" onClick={() => commit((p) => moveStop(p, i, -1))} disabled={i === 0} aria-label={t('route.up')}>↑</button>
                  <button className="btn ghost icon" onClick={() => commit((p) => moveStop(p, i, 1))} disabled={i === project.journey.stops.length - 1} aria-label={t('route.down')}>↓</button>
                  <button className="btn ghost icon danger" onClick={() => commit((p) => removeStop(p, s.id))} aria-label={t('route.remove')}>✕</button>
                </div>
                {i > 0 && i < project.journey.stops.length - 1 && (
                  <div className="row wrap stop-opts">
                    <label className="small">{t('route.pauseS')}
                      <input type="number" min={0} max={10} step={0.5} value={s.pauseMs / 1000}
                        onChange={(e) => commit((p) => updateStop(p, s.id, { pauseMs: Math.max(0, Math.min(10_000, Math.round(Number(e.target.value) * 1000))) }))} />
                    </label>
                    <label className="toggle small"><input type="checkbox" checked={s.zoomIn} onChange={(e) => commit((p) => updateStop(p, s.id, { zoomIn: e.target.checked }))} />{t('route.zoomIn')}</label>
                  </div>
                )}
                {seg && (
                  <div className={`segment conf-${seg.confidence}`} data-testid="segment">
                    <select value={seg.mode} onChange={(e) => setMode(seg.id, e.target.value as TransportMode)} disabled={busy} aria-label={t('route.segment', { n: i + 1 })} data-testid="segment-mode">
                      {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{t(`mode.${m}`)}</option>)}
                    </select>
                    <span className="small">{formatKm(locale, seg.distanceM)}</span>
                    <span className={`badge conf ${seg.confidence}`} data-testid="segment-confidence">{t(`conf.${seg.confidence}`)}</span>
                    {seg.alternatives.length > 1 && (
                      <select value={seg.selectedAlternative} aria-label="alternatives"
                        onChange={(e) => {
                          const k = Number(e.target.value);
                          const alt = seg.alternatives[k]!;
                          commit((p) => updateSegment(p, seg.id, { selectedAlternative: k, distanceM: alt.distanceM, etaS: alt.etaS }));
                        }}>
                        {seg.alternatives.map((a, k) => <option key={k} value={k}>{t('route.alternative', { n: k + 1 })} · {formatKm(locale, a.distanceM)}</option>)}
                      </select>
                    )}
                    {seg.warnings.filter((w) => !w.startsWith('online') ).map((w) => <p key={w} className="small warn">{t(`warn.${w}` as MessageKey)}</p>)}
                    <button className="btn small" onClick={() => setEditId(editId === seg.id ? null : seg.id)} aria-pressed={editId === seg.id} disabled={busy} data-testid="segment-edit">
                      {t('route.editLine')}
                    </button>
                    {seg.attribution && <p className="small muted">{seg.attribution}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {estimatedRoad.length > 0 && (
          <div className="card" role="status">
            {!online && <p className="small">{t('route.roadsHint', { router: ROUTER_NAME })}</p>}
            <button className="btn primary small" onClick={() => { setOnline(true); void recomputeRoads(); }} disabled={busy} data-testid="compute-roads">
              {online ? t('route.retryRoads') : t('route.computeRoads')}
            </button>
          </div>
        )}
        <label className="toggle small">
          <input type="checkbox" checked={online} onChange={(e) => { setOnline(e.target.checked); if (e.target.checked) void recomputeRoads(); }} data-testid="online-toggle" />
          {t('route.onlineToggle', { router: ROUTER_NAME })}
        </label>
      </div>
    </div>
  );
}
