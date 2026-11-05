const BACKUP_MAGIC = 'surtivoxpos';
const FORBIDDEN_TABLES = new Set(['_migrations', 'sync_state']);
const NEWER_VERSION = 'Este respaldo parece ser de una versión más nueva de Surtivox. Actualiza la app e inténtalo de nuevo.';

export type BackupValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCell(value: unknown): boolean {
  return value === null
    || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value));
}

export function validateBackupPayload(
  payload: unknown,
  schema: Record<string, readonly string[]>,
  appliedMigrations: number,
): BackupValidationResult {
  if (!isRecord(payload) || payload.app !== BACKUP_MAGIC || !isRecord(payload.tables)) {
    return { ok: false, reason: 'El archivo no es un respaldo válido de Surtivox.' };
  }

  if (payload.migrations !== undefined) {
    if (
      typeof payload.migrations !== 'number'
      || !Number.isInteger(payload.migrations)
      || payload.migrations < 0
    ) {
      return { ok: false, reason: 'El respaldo tiene una versión de datos inválida.' };
    }
    if (payload.migrations > appliedMigrations) {
      return { ok: false, reason: NEWER_VERSION };
    }
  }

  for (const [table, rows] of Object.entries(payload.tables)) {
    if (
      FORBIDDEN_TABLES.has(table)
      || table.startsWith('sqlite_')
      || !Object.prototype.hasOwnProperty.call(schema, table)
    ) {
      return { ok: false, reason: NEWER_VERSION };
    }
    if (!Array.isArray(rows)) {
      return { ok: false, reason: 'El respaldo contiene una tabla con un formato inválido.' };
    }
    const columns = new Set(schema[table]);
    for (const row of rows) {
      if (!isRecord(row)) {
        return { ok: false, reason: 'El respaldo contiene una fila con un formato inválido.' };
      }
      for (const [column, value] of Object.entries(row)) {
        if (!columns.has(column)) {
          return { ok: false, reason: 'El respaldo contiene una columna que esta versión de Surtivox no reconoce.' };
        }
        if (!isValidCell(value)) {
          return { ok: false, reason: 'El respaldo contiene un valor que no se puede importar.' };
        }
      }
    }
  }

  return { ok: true };
}

export function verifyBackupText(text: string, expectedRows: number): BackupValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'El archivo guardado está dañado.' };
  }
  if (!isRecord(parsed) || parsed.app !== BACKUP_MAGIC || !isRecord(parsed.tables)) {
    return { ok: false, reason: 'El archivo guardado no es un respaldo válido.' };
  }
  let rows = 0;
  for (const list of Object.values(parsed.tables)) {
    if (!Array.isArray(list)) return { ok: false, reason: 'El archivo guardado tiene una tabla inválida.' };
    rows += list.length;
  }
  if (rows !== expectedRows) {
    return { ok: false, reason: `El archivo guardado está incompleto (${rows} de ${expectedRows} registros).` };
  }
  return { ok: true };
}
