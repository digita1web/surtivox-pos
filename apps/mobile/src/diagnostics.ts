const MAX_ERROR_LENGTH = 300;

export interface StoredError {
  at: number;
  message: string;
}

export interface DiagnosticsData {
  appVersion: string;
  runtimeVersion: string | null;
  updateId: string | null;
  dbSizeBytes: number | null;
  migrations: number;
  lastMigration: string | null;
  lastBackupAt: number | null;
  cameraRestarts: string | null;
  catalogConfigured: boolean;
  catalogOptIn: boolean | null;
  catalogPending: number;
  lastError: string | null;
}

export function truncateErrorMessage(input: unknown): string {
  const raw = input instanceof Error
    ? input.message
    : typeof input === 'string'
      ? input
      : 'Error desconocido';
  const clean = raw.replace(/\s+/g, ' ').trim();
  return clean.slice(0, MAX_ERROR_LENGTH);
}

export function formatLastError(raw: string | null): string {
  if (!raw) return 'Sin error registrado.';
  try {
    const parsed = JSON.parse(raw) as Partial<StoredError>;
    if (
      typeof parsed.at !== 'number'
      || !Number.isFinite(parsed.at)
      || typeof parsed.message !== 'string'
      || !parsed.message.trim()
    ) {
      return 'Registro de error no disponible.';
    }
    return `${new Date(parsed.at).toISOString()} · ${parsed.message.slice(0, MAX_ERROR_LENGTH)}`;
  } catch {
    return 'Registro de error no disponible.';
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return 'No disponible';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildDiagnosticsText(data: DiagnosticsData): string {
  const lines = [
    'Surtivox POS · diagnóstico',
    `Versión de la app: ${data.appVersion}`,
    `Runtime: ${data.runtimeVersion ?? 'No disponible'}`,
  ];
  if (data.updateId) lines.push(`Actualización: ${data.updateId}`);
  lines.push(
    `Base de datos: ${formatBytes(data.dbSizeBytes)}`,
    `Migraciones aplicadas: ${data.migrations}`,
    `Última migración: ${data.lastMigration ?? 'Ninguna'}`,
    `Último respaldo generado: ${data.lastBackupAt === null ? 'Nunca' : new Date(data.lastBackupAt).toISOString()}`,
    `Reinicios de cámara: ${data.cameraRestarts ?? '0'}`,
    `Catálogo comunitario: ${data.catalogConfigured ? 'Configurado' : 'No configurado'}`,
    `Consentimiento del catálogo: ${data.catalogOptIn === null ? 'Sin decidir' : data.catalogOptIn ? 'Activo' : 'Inactivo'}`,
    `Pendientes del catálogo: ${data.catalogPending}`,
    `Último error: ${formatLastError(data.lastError)}`,
  );
  return lines.join('\n');
}
