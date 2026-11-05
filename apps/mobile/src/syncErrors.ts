const MESSAGES: Record<string, string> = {
  store_already_claimed: 'Esta tienda ya está vinculada a otra llave de respaldo. Usa el kit original para sincronizar.',
  'token already bound to another store': 'Este kit pertenece a otra tienda.',
  unauthorized: 'El kit de la tienda no es válido.',
  invalid_request: 'La solicitud no es válida. Revisa el kit e inténtalo de nuevo.',
  conflict: 'La llave cambió en otro teléfono mientras la cambiabas. Inténtalo de nuevo.',
};

export const KEY_CHANGED_MESSAGE = 'La llave de la tienda cambió. Ingresa el nuevo kit de recuperación.';

export class SyncHttpError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;
  constructor(message: string, status: number, code: string | null, retryAfterSeconds: number | null) {
    super(message);
    this.name = 'SyncHttpError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function waitMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Demasiados intentos. Espera ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} e inténtalo de nuevo.`;
}

export function syncErrorMessage(serverError: unknown, status: number, retryAfterSeconds: number | null = null): string {
  if (status === 429) return waitMessage(retryAfterSeconds ?? 60);
  if (typeof serverError === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, serverError)) {
    return MESSAGES[serverError]!;
  }
  return `Error de sincronización (${status})`;
}

export function toSyncHttpError(body: unknown, status: number, retryAfterHeader: string | null): SyncHttpError {
  const code = typeof (body as { error?: unknown } | null)?.error === 'string' ? (body as { error: string }).error : null;
  const parsed = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
  const retryAfter = Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
  return new SyncHttpError(syncErrorMessage(code, status, retryAfter), status, code, retryAfter);
}
