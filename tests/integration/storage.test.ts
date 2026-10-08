import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteProject, getBlob, listProjects, loadProject, putBlob, saveProject, _resetDbHandle } from '../../src/adapters/storage/idb';
import { multimodalProject } from '../fixtures/project';
import { openDB } from 'idb';

describe('IndexedDB storage', () => {
  beforeEach(async () => {
    await _resetDbHandle();
    await new Promise((r) => { const q = indexedDB.deleteDatabase('arc-local'); q.onsuccess = q.onerror = q.onblocked = r; });
  });
  it('save → reload (new handle) returns identical project', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    await _resetDbHandle();
    expect(await loadProject(p.id)).toEqual(p);
  });
  it('broken records are reported, not deleted', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    const db = await openDB('arc-local', 1);
    await db.put('projects', { id: 'broken-1', schemaVersion: 1, title: 5 });
    db.close();
    const r = await listProjects();
    expect(r.projects).toHaveLength(1);
    expect(r.broken).toEqual([{ id: 'broken-1', error: 'invalid' }]);
    const db2 = await openDB('arc-local', 1);
    expect(await db2.get('projects', 'broken-1')).toBeTruthy();
    db2.close();
  });
  it('delete removes project and its blobs', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    await putBlob({ id: 'b1', projectId: p.id, name: 'a.mp3', type: 'audio/mpeg', size: 3, blob: new Blob(['abc']) });
    expect(await getBlob('b1')).toBeTruthy();
    await deleteProject(p.id);
    expect(await loadProject(p.id)).toBeNull();
    expect(await getBlob('b1')).toBeUndefined();
  });
  it('refuses to persist invalid projects', async () => {
    const p = await multimodalProject();
    await expect(saveProject({ ...p, targetDurationMs: 999_999 })).rejects.toThrow();
  });
});
