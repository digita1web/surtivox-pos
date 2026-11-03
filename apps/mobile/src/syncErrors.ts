const MESSAGES: Record<string, string> = {
  store_already_claimed: 'Esta tienda ya está vinculada a otro código de respaldo. Usa el código original para sincronizar.',
  'token already bound to another store': 'Este código de respaldo pertenece a otra tienda.',
  unauthorized: 'El código de la tienda no es válido.',
  invalid_request: 'La solicitud no es válida. Revisa el código e inténtalo de nuevo.',
};

export function syncErrorMessage(serverError: unknown, status: number): string {
  if (typeof serverError === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, serverError)) {
    return MESSAGES[serverError]!;
  }
  return `Error de sincronización (${status})`;
}
