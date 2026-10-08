import { CURRENT_SCHEMA_VERSION, ProjectSchema, type Project } from './schema';

/**
 * Idempotente Migrationen: Jede Funktion hebt genau eine Version an.
 * Unbekannte/neuere Versionen werden nicht verändert, sondern als Fehler gemeldet (kein stilles Löschen).
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: Ausgangsversion – noch keine Migration nötig.
};

export class ProjectLoadError extends Error {
  constructor(
    public readonly code: 'newer_version' | 'invalid' | 'not_object',
    message: string,
  ) {
    super(message);
    this.name = 'ProjectLoadError';
  }
}

export function migrateAndValidate(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new ProjectLoadError('not_object', 'Project data is not an object');
  let data = { ...(raw as Record<string, unknown>) };
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) throw new ProjectLoadError('newer_version', `Project schema ${version} is newer than supported ${CURRENT_SCHEMA_VERSION}`);
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ProjectLoadError('invalid', `No migration from schema ${version}`);
    data = step(data);
    version = data.schemaVersion as number;
  }
  const parsed = ProjectSchema.safeParse(data);
  if (!parsed.success) throw new ProjectLoadError('invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}
