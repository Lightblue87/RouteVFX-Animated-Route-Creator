import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteProject, listProjects, loadProject, saveProject, _resetDbHandle } from '../../src/adapters/storage/idb';
import { journalClearIfSame, journalEntries, journalWrite } from '../../src/adapters/storage/journal';
import { multimodalProject } from '../fixtures/project';

const edit = <T extends { modifiedAt: string; title: string }>(p: T, title: string, iso: string): T => ({ ...p, title, modifiedAt: iso });

describe('Schreib-Journal: Änderung überlebt abgebrochenen IndexedDB-Schreibvorgang', () => {
  beforeEach(async () => {
    localStorage.clear();
    await _resetDbHandle();
    await new Promise((r) => { const q = indexedDB.deleteDatabase('arc-local'); q.onsuccess = q.onerror = q.onblocked = r; });
  });

  it('journal newer than the stored project is applied on load and then cleared', async () => {
    const p = await multimodalProject();
    await saveProject(p); // „Untitled trip“ ist gespeichert
    const edited = edit(p, 'Sofort zurück', '2099-01-01T00:00:00.000Z');
    expect(journalWrite(edited)).toBe(true); // Schreibvorgang der Änderung ging verloren, nur das Journal ist da
    await _resetDbHandle();
    expect((await loadProject(p.id))?.title).toBe('Sofort zurück');
    expect(journalEntries()).toEqual([]);
    await _resetDbHandle();
    expect((await loadProject(p.id))?.title).toBe('Sofort zurück'); // wirklich in IndexedDB gelandet
  });
  it('recovery runs once per page start, not after every navigation (no duplicate writes while a save is in flight)', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    await loadProject(p.id); // Seitenstart: nichts zu tun
    journalWrite(edit(p, 'Läuft gerade', '2099-01-01T00:00:00.000Z')); // Journal des laufenden Seitenlebens (Speichern ist unterwegs)
    expect((await listProjects()).projects[0]!.title).toBe(p.title); // nicht eingespielt
    expect(journalEntries()).toHaveLength(1);
    await _resetDbHandle(); // nächster Seitenstart
    expect((await listProjects()).projects[0]!.title).toBe('Läuft gerade');
    expect(journalEntries()).toEqual([]);
  });
  it('the project list shows the recovered state too', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    journalWrite(edit(p, 'Aus Journal', '2099-01-01T00:00:00.000Z'));
    expect((await listProjects()).projects.map((x) => x.title)).toEqual(['Aus Journal']);
  });
  it('a journal older than the stored project is discarded (edited in another tab meanwhile)', async () => {
    const p = await multimodalProject();
    journalWrite(edit(p, 'Alt', '2000-01-01T00:00:00.000Z'));
    await saveProject(edit(p, 'Neu', '2099-01-01T00:00:00.000Z'));
    expect((await loadProject(p.id))?.title).toBe('Neu');
    expect(journalEntries()).toEqual([]);
  });
  it('never resurrects a deleted project', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    journalWrite(edit(p, 'Gelöscht', '2099-01-01T00:00:00.000Z'));
    await deleteProject(p.id);
    expect(journalEntries()).toEqual([]);
    expect(await loadProject(p.id)).toBeNull();
    // auch ein Journal ohne Projekt (z. B. in anderem Tab gelöscht) wird verworfen, nicht wiederhergestellt
    journalWrite(edit(p, 'Geist', '2099-01-01T00:00:00.000Z'));
    await _resetDbHandle(); // neuer Seitenstart
    expect(await loadProject(p.id)).toBeNull();
    expect(journalEntries()).toEqual([]);
    expect((await listProjects()).projects).toEqual([]);
  });
  it('corrupt or invalid journals are dropped without breaking loading', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    localStorage.setItem('arc.journal.v1.zzz', '{not json');
    localStorage.setItem(`arc.journal.v1.${p.id}`, JSON.stringify({ ...p, targetDurationMs: 999_999 }));
    expect((await loadProject(p.id))?.title).toBe(p.title);
    expect(journalEntries()).toEqual([]);
  });
  it('a normal save clears only the matching journal (a newer one is kept)', async () => {
    const p = await multimodalProject();
    const a = edit(p, 'A', '2099-01-01T00:00:00.000Z');
    const b = edit(p, 'B', '2099-01-02T00:00:00.000Z');
    journalWrite(b);
    journalClearIfSame(a); // älterer Schreibvorgang abgeschlossen → neueres Journal bleibt
    expect(journalEntries()).toHaveLength(1);
    journalClearIfSame(b);
    expect(journalEntries()).toEqual([]);
  });
  it('works without localStorage (blocked or full) – no exception', async () => {
    const p = await multimodalProject();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(journalWrite(p)).toBe(false);
    spy.mockRestore();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => journalClearIfSame(p)).not.toThrow();
    get.mockRestore();
  });
  it('keeps the journal when the write fails with a storage error (retry later)', async () => {
    const p = await multimodalProject();
    await saveProject(p);
    journalWrite(edit(p, 'Später', '2099-01-01T00:00:00.000Z'));
    await _resetDbHandle();
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    await loadProject(p.id);
    spy.mockRestore();
    expect(journalEntries()).toHaveLength(1);
    expect((await loadProject(p.id))?.title).toBe('Später'); // zweiter Versuch gelingt
    expect(journalEntries()).toEqual([]);
  });
});
