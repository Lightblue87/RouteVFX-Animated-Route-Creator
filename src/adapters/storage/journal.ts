import type { Project } from '../../core/project/schema';

/**
 * Schreib-Journal in localStorage (synchron). IndexedDB-Schreibvorgänge sind asynchron: Wird die Seite direkt nach
 * dem Verlassen des Editors neu geladen oder geschlossen, kann die noch offene Transaktion abgebrochen werden
 * (reproduziert: „Zurück“ + sofortiger Reload unter Last → letzte Änderung weg). Deshalb wird der noch nicht
 * bestätigte Stand beim Verlassen zusätzlich synchron hier gesichert und beim nächsten Start eingespielt
 * (recoverJournals in idb.ts). Das Journal enthält nur das Projekt-JSON, keine Medien-Blobs.
 */
const PREFIX = 'arc.journal.v1.';
/** Sicherheitsgrenze unterhalb des localStorage-Kontingents (~5 MB je Origin). */
const MAX_CHARS = 2_000_000;

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // z. B. blockierter Speicher in privaten Fenstern
  }
}

export function journalWrite(p: Project): boolean {
  const s = store();
  if (!s) return false;
  try {
    const json = JSON.stringify(p);
    if (json.length > MAX_CHARS) return false;
    s.setItem(PREFIX + p.id, json);
    return true;
  } catch {
    return false; // Kontingent voll o. Ä.: kein Journal, IndexedDB-Pfad bleibt bestehen
  }
}

/** Entfernt das Journal von `p`, aber nur wenn es genau diesen Stand enthält (ein neuerer bleibt erhalten). */
export function journalClearIfSame(p: Project): void {
  const s = store();
  if (!s) return;
  try {
    const raw = s.getItem(PREFIX + p.id);
    if (raw !== null && raw === JSON.stringify(p)) s.removeItem(PREFIX + p.id);
  } catch {
    /* ignorieren */
  }
}

export function journalRemove(id: string): void {
  try {
    store()?.removeItem(PREFIX + id);
  } catch {
    /* ignorieren */
  }
}

export function journalEntries(): { id: string; raw: string }[] {
  const s = store();
  if (!s) return [];
  const out: { id: string; raw: string }[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (key?.startsWith(PREFIX)) {
        const raw = s.getItem(key);
        if (raw !== null) out.push({ id: key.slice(PREFIX.length), raw });
      }
    }
  } catch {
    /* ignorieren */
  }
  return out;
}
