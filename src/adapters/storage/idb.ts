import { openDB, type IDBPDatabase } from 'idb';
import { migrateAndValidate, ProjectLoadError } from '../../core/project/migrations';
import type { Project } from '../../core/project/schema';
import { newId } from '../../core/project/factory';
import { journalClearIfSame, journalEntries, journalRemove } from './journal';

/**
 * Lokale Persistenz (IndexedDB). Projekte als validiertes JSON, Medien getrennt als Blobs.
 * Nutzerdaten werden niemals automatisch gelöscht; defekte Datensätze werden gemeldet, nicht verworfen.
 */
const DB_NAME = 'arc-local';
const DB_VERSION = 1;

export interface StoredBlob {
  id: string;
  projectId: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  /** Zeitpunkt des Schreibens (ms). Fehlt bei älteren Einträgen; dient dem Schutz frisch importierter Medien vor dem Aufräumen. */
  createdAt?: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  modifiedAt: string;
  stops: number;
}

export interface LoadReport {
  projects: Project[];
  broken: { id: string; error: string }[];
}

let dbp: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  dbp ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('blobs')) {
        const s = d.createObjectStore('blobs', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId');
      }
    },
  });
  return dbp;
}

/** Nur für Tests: Verbindung schließen und Handle verwerfen. */
export async function _resetDbHandle(): Promise<void> {
  const d = dbp;
  dbp = null;
  recovery = null;
  (await d?.catch(() => null))?.close();
}

export class StorageError extends Error {
  constructor(public readonly code: 'quota' | 'newer_version' | 'unknown', message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

function wrap(e: unknown): never {
  const name = (e as DOMException)?.name;
  if (name === 'QuotaExceededError') throw new StorageError('quota', 'Storage quota exceeded');
  throw new StorageError('unknown', (e as Error)?.message ?? String(e));
}

export async function saveProject(p: Project): Promise<void> {
  // Vor dem Schreiben validieren – verhindert das Persistieren inkonsistenter Zustände.
  const valid = migrateAndValidate(p);
  try {
    // Ein veralteter Tab (älterer App-Stand) darf einen neueren Datensatz nicht überschreiben: Er würde Felder
    // verlieren, die er nicht kennt (z. B. Fotos), und deren Bilddaten später zum Aufräumen freigeben.
    const tx = (await db()).transaction('projects', 'readwrite');
    const stored = (await tx.store.get(valid.id)) as { schemaVersion?: number } | undefined;
    if (typeof stored?.schemaVersion === 'number' && stored.schemaVersion > valid.schemaVersion) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw new StorageError('newer_version', 'stored project is newer than this app version');
    }
    await tx.store.put(valid);
    await tx.done;
  } catch (e) {
    if (e instanceof StorageError) throw e;
    wrap(e);
  }
}

let recovery: Promise<boolean> | null = null;

/**
 * Spielt Journal-Einträge ein, deren IndexedDB-Schreibvorgang nicht bestätigt wurde (Seite beim Speichern verlassen).
 * Läuft einmal je Seitenstart, vor dem ersten Lesen: Ein Journal stammt immer aus einem früheren Seitenleben – im
 * laufenden Seitenleben ist der noch offene Schreibvorgang selbst zuständig (kein doppeltes Schreiben nach „Zurück“).
 * Angewendet wird nur, wenn das Projekt noch existiert und nicht neuer gespeichert wurde (z. B. in einem anderen
 * Tab); gelöschte Projekte werden nie wiederbelebt. Bei Speicherfehlern (Kontingent) bleibt das Journal erhalten
 * und der nächste Zugriff versucht es erneut.
 */
export async function recoverJournals(): Promise<void> {
  recovery ??= (async () => {
    let complete = true;
    for (const { id, raw } of journalEntries()) {
      try {
        const journal = migrateAndValidate(JSON.parse(raw));
        const stored = await (await db()).get('projects', id);
        if (!stored) {
          journalRemove(id);
          continue;
        }
        let storedNewer = false;
        try {
          storedNewer = migrateAndValidate(stored).modifiedAt > journal.modifiedAt;
        } catch {
          /* gespeicherter Datensatz defekt → das Journal ist die bessere Kopie */
        }
        if (storedNewer) {
          journalRemove(id);
          continue;
        }
        await saveProject(journal);
        journalClearIfSame(journal);
      } catch (e) {
        if (e instanceof StorageError && e.code === 'newer_version') continue; // neuerer Datensatz: Journal behalten, nicht überschreiben
        if (e instanceof StorageError) complete = false; // später erneut versuchen, Journal behalten
        else journalRemove(id); // unlesbar/ungültig: verwerfen
      }
    }
    return complete;
  })();
  if (!(await recovery)) recovery = null;
}

export async function loadProject(id: string): Promise<Project | null> {
  await recoverJournals();
  const raw = await (await db()).get('projects', id);
  return raw ? migrateAndValidate(raw) : null;
}

export async function listProjects(): Promise<LoadReport> {
  await recoverJournals();
  const all = await (await db()).getAll('projects');
  const report: LoadReport = { projects: [], broken: [] };
  for (const raw of all) {
    try {
      report.projects.push(migrateAndValidate(raw));
    } catch (e) {
      report.broken.push({ id: String((raw as { id?: unknown })?.id ?? '?'), error: e instanceof ProjectLoadError ? e.code : 'invalid' });
    }
  }
  report.projects.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return report;
}

export async function deleteProject(id: string): Promise<void> {
  journalRemove(id); // sonst könnte ein altes Journal das gelöschte Projekt wiederbeleben
  const d = await db();
  const tx = d.transaction(['projects', 'blobs'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  const idx = tx.objectStore('blobs').index('projectId');
  for (const key of await idx.getAllKeys(id)) await tx.objectStore('blobs').delete(key);
  await tx.done;
}

/**
 * Dupliziert ein Projekt samt referenzierter Medien-Blobs (neue IDs, neuer Projektbezug) in einer Transaktion.
 * So bleibt die Kopie vollständig, auch wenn das Original später gelöscht wird.
 */
export async function duplicateProject(p: Project, title: string): Promise<Project> {
  const id = newId();
  const now = new Date().toISOString();
  const d = await db();
  const tx = d.transaction(['projects', 'blobs'], 'readwrite');
  const blobs = tx.objectStore('blobs');
  let audio = p.audio;
  if (audio) {
    const b = (await blobs.get(audio.assetId)) as StoredBlob | undefined;
    if (b) {
      const assetId = newId();
      await blobs.put({ ...b, id: assetId, projectId: id, createdAt: Date.now() });
      audio = { ...audio, assetId };
    }
  }
  // Fotos: jede Kopie bekommt eigene Blob-IDs, damit sie das Löschen des Originals überlebt.
  const photos = [];
  for (const ph of p.photos) {
    const b = (await blobs.get(ph.assetId)) as StoredBlob | undefined;
    if (!b) {
      photos.push(ph); // Blob fehlt bereits im Original: Verweis unverändert lassen statt Daten zu erfinden
      continue;
    }
    const assetId = newId();
    await blobs.put({ ...b, id: assetId, projectId: id, createdAt: Date.now() });
    photos.push({ ...ph, assetId });
  }
  const copy = migrateAndValidate({ ...structuredClone(p), id, title: title.slice(0, 80), createdAt: now, modifiedAt: now, audio, photos });
  try {
    await tx.objectStore('projects').put(copy);
    await tx.done;
  } catch (e) {
    wrap(e);
  }
  return copy;
}

/**
 * Löscht Blobs eines Projekts, die nicht in `keep` stehen (z. B. entfernte oder ersetzte Audiodateien).
 * Nur aufrufen, wenn keine Undo-Historie mehr auf ältere Blobs verweisen kann – etwa beim Öffnen eines Projekts.
 */
export const PRUNE_GRACE_MS = 10 * 60_000;

export async function pruneUnreferencedBlobs(projectId: string, keep: readonly string[], graceMs = PRUNE_GRACE_MS, now = Date.now()): Promise<number> {
  const d = await db();
  const tx = d.transaction('blobs', 'readwrite');
  let removed = 0;
  for (const key of await tx.store.index('projectId').getAllKeys(projectId)) {
    if (keep.includes(String(key))) continue;
    // Frisch importierte Medien sind evtl. noch nicht im gespeicherten Projekt vermerkt (Autosave-Verzögerung, zweiter Tab).
    const b = (await tx.store.get(key)) as StoredBlob | undefined;
    if (b?.createdAt !== undefined && now - b.createdAt < graceMs) continue;
    await tx.store.delete(key);
    removed++;
  }
  await tx.done;
  return removed;
}

export async function putBlob(b: StoredBlob): Promise<void> {
  try {
    await (await db()).put('blobs', { ...b, createdAt: b.createdAt ?? Date.now() });
  } catch (e) {
    wrap(e);
  }
}

export async function getBlob(id: string): Promise<StoredBlob | undefined> {
  return (await db()).get('blobs', id);
}

export async function storageEstimate(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = await navigator.storage?.persisted?.().catch(() => undefined);
  return { usage: est?.usage, quota: est?.quota, persisted };
}

/** Bittet den Browser um dauerhaften Speicher (verringert automatisches Löschen; keine Garantie). */
export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.().catch(() => false)) ?? false;
}
