import { useEffect, useState } from 'react';
import { useI18n } from './App';
import { createProject, newId } from '../core/project/factory';
import type { Project } from '../core/project/schema';
import { deleteProject, listProjects, requestPersistence, saveProject } from '../adapters/storage/idb';

export function Home({ open }: { open: (id: string) => void }) {
  const { t, locale, setLocale } = useI18n();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [broken, setBroken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    listProjects()
      .then((r) => {
        setProjects(r.projects);
        setBroken(r.broken.length);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void refresh();
  }, []);

  const create = async () => {
    const p = createProject(locale);
    await saveProject(p);
    void requestPersistence();
    open(p.id);
  };
  const duplicate = async (p: Project) => {
    const now = new Date().toISOString();
    await saveProject({ ...structuredClone(p), id: newId(), title: `${p.title || t('common.untitled')} (2)`.slice(0, 80), createdAt: now, modifiedAt: now });
    void refresh();
  };
  const remove = async (p: Project) => {
    if (!confirm(t('common.confirmDelete', { title: p.title || t('common.untitled') }))) return;
    await deleteProject(p.id);
    void refresh();
  };

  return (
    <div className="screen home">
      <header className="topbar">
        <h1>{t('app.name')}</h1>
        <button className="btn ghost" onClick={() => setLocale(locale === 'de' ? 'en' : 'de')} aria-label="Language">
          {t('lang.switch')}
        </button>
      </header>
      <p className="badge warn">{t('app.prototype')}</p>
      <button className="btn primary big" onClick={create} data-testid="create-project">
        {t('home.create')}
      </button>
      <h2>{t('home.projects')}</h2>
      {error && <p className="error">{error}</p>}
      {broken > 0 && <p className="error">{t('home.broken', { n: broken })}</p>}
      {projects?.length === 0 && <p className="muted">{t('home.empty')}</p>}
      <ul className="list">
        {projects?.map((p) => (
          <li key={p.id} className="card row">
            <button className="grow link" onClick={() => open(p.id)}>
              <strong>{p.title || t('common.untitled')}</strong>
              <span className="muted small">
                {p.journey.stops.map((s) => s.label).filter(Boolean).slice(0, 4).join(' → ')} · {new Date(p.modifiedAt).toLocaleString(locale)}
              </span>
            </button>
            <button className="btn ghost small" onClick={() => duplicate(p)}>{t('common.duplicate')}</button>
            <button className="btn danger small" onClick={() => remove(p)}>{t('common.delete')}</button>
          </li>
        ))}
      </ul>
      <section className="card note">
        <h3>{t('privacy.title')}</h3>
        <p className="small">{t('privacy.body')}</p>
        <p className="small muted">{t('home.localNote')}</p>
      </section>
    </div>
  );
}
