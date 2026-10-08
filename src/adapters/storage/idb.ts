import { openDB, type IDBPDatabase } from 'idb';
import { migrateAndValidate, ProjectLoadError } from '../../core/project/migrations';
import type { Project } from '../../core/project/schema';
import { newId } from '../../core/project/factory';

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
  (await d?.catch(() => null))?.close();
}

export class StorageError extends Error {
  constructor(public readonly code: 'quota' | 'unknown', message: string) {
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
    await (await db()).put('projects', valid);
  } catch (e) {
    wrap(e);
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  const raw = await (await db()).get('projects', id);
  return raw ? migrateAndValidate(raw) : null;
}

export async function listProjects(): Promise<LoadReport> {
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
      await blobs.put({ ...b, id: assetId, projectId: id });
      audio = { ...audio, assetId };
    }
  }
  const copy = migrateAndValidate({ ...structuredClone(p), id, title: title.slice(0, 80), createdAt: now, modifiedAt: now, audio });
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
export async function pruneUnreferencedBlobs(projectId: string, keep: readonly string[]): Promise<number> {
  const d = await db();
  const tx = d.transaction('blobs', 'readwrite');
  let removed = 0;
  for (const key of await tx.store.index('projectId').getAllKeys(projectId)) {
    if (keep.includes(String(key))) continue;
    await tx.store.delete(key);
    removed++;
  }
  await tx.done;
  return removed;
}

export async function putBlob(b: StoredBlob): Promise<void> {
  try {
    await (await db()).put('blobs', b);
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
