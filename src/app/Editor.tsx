import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from './App';
import type { Project } from '../core/project/schema';
import { loadProject, pruneUnreferencedBlobs, saveProject, StorageError } from '../adapters/storage/idb';
import { RoutePanel } from './RoutePanel';
import { AnimatePanel } from './AnimatePanel';
const ExportPanel = lazy(() => import('./ExportPanel').then((m) => ({ default: m.ExportPanel })));

type Tab = 'route' | 'animate' | 'export';
type SaveState = 'saved' | 'saving' | 'error' | 'quota';

export interface ProjectApi {
  project: Project;
  /** Änderung mit Undo-Eintrag. */
  commit: (next: Project | ((p: Project) => Project)) => void;
}

const HISTORY_LIMIT = 50;

export function Editor({ projectId, close }: { projectId: string; close: () => void }) {
  const { t } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('route');
  const [save, setSave] = useState<SaveState>('saved');
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    loadProject(projectId)
      .then((p) => {
        if (!p) return setLoadError('not_found');
        setProject(p);
        // Beim Öffnen gibt es noch keine Undo-Historie: nicht mehr referenzierte Medien freigeben.
        void pruneUnreferencedBlobs(p.id, p.audio ? [p.audio.assetId] : []).catch(() => undefined);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [projectId]);

  // Autosave mit Debounce. Ein noch ausstehender Stand wird beim Verlassen (Zurück, Reload, Tab schließen,
  // App in den Hintergrund) sofort geschrieben, damit der Debounce keine Änderungen verwirft.
  const firstLoad = useRef(true);
  const pending = useRef<Project | null>(null);
  const persist = useCallback((p: Project) => {
    if (pending.current === p) pending.current = null;
    return saveProject(p)
      .then(() => setSave('saved'))
      .catch((e) => setSave(e instanceof StorageError && e.code === 'quota' ? 'quota' : 'error'));
  }, []);
  const flush = useCallback(() => {
    const p = pending.current;
    if (p) void persist(p);
  }, [persist]);

  useEffect(() => {
    if (!project) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    pending.current = project;
    setSave('saving');
    const h = setTimeout(() => void persist(project), 500);
    return () => clearTimeout(h);
  }, [project, persist]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush(); // Unmount (z. B. „Zurück“)
    };
  }, [flush]);

  const commit = useCallback((next: Project | ((p: Project) => Project)) => {
    setProject((cur) => {
      if (!cur) return cur;
      const n = typeof next === 'function' ? next(cur) : next;
      if (n === cur) return cur;
      past.current = [...past.current.slice(-HISTORY_LIMIT + 1), cur];
      future.current = [];
      return n;
    });
    force((x) => x + 1);
  }, []);

  const undo = () => {
    const prev = past.current.pop();
    if (!prev || !project) return;
    future.current.push(project);
    setProject(prev);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next || !project) return;
    past.current.push(project);
    setProject(next);
  };

  if (loadError) {
    return (
      <div className="screen center" role="alert">
        <p className="error">{loadError}</p>
        <button className="btn" onClick={close}>{t('common.back')}</button>
      </div>
    );
  }
  if (!project) return <div className="screen center" aria-busy="true">…</div>;

  const api: ProjectApi = { project, commit };
  const saveLabel = { saved: t('common.saved'), saving: t('common.saving'), error: t('common.saveError'), quota: t('common.quotaError') }[save];

  return (
    <div className="screen editor">
      <header className="topbar">
        <button className="btn ghost" onClick={close} aria-label={t('common.back')}>‹ {t('common.back')}</button>
        <span className={`save ${save}`} role="status" data-testid="save-state">{saveLabel}</span>
        <div className="row">
          <button className="btn ghost icon" onClick={undo} disabled={!past.current.length} aria-label={t('common.undo')}>↶</button>
          <button className="btn ghost icon" onClick={redo} disabled={!future.current.length} aria-label={t('common.redo')}>↷</button>
        </div>
      </header>
      <main className="tabbody">
        {tab === 'route' && <RoutePanel api={api} />}
        {tab === 'animate' && <AnimatePanel api={api} />}
        {tab === 'export' && <Suspense fallback={<p aria-busy="true">…</p>}><ExportPanel project={project} /></Suspense>}
      </main>
      <nav className="tabbar" role="tablist">
        {(['route', 'animate', 'export'] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
            {t(`tab.${k}`)}
          </button>
        ))}
      </nav>
    </div>
  );
}
