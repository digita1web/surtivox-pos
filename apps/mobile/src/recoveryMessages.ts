import type { RecoveryResult } from './recoveryOps.ts';
import { formatWait } from './staffRules.ts';

export const NO_RECOVERY_MESSAGE =
  'Esta tienda no tiene código de recuperación. Si hay otro propietario, pídele que cambie tu PIN en Personal y roles. Si no, la única salida es borrar los datos de la app.';

export function recoveryFailureMessage(result: RecoveryResult, now: number): string | null {
  switch (result.status) {
    case 'ok':
      return null;
    case 'wrong':
      return `Código incorrecto. Te ${result.attemptsLeft === 1 ? 'queda 1 intento' : `quedan ${result.attemptsLeft} intentos`} antes de un bloqueo temporal.`;
    case 'locked':
      return `Demasiados intentos. Intenta de nuevo en ${formatWait(result.retryAt - now)}.`;
    case 'bad-format':
      return 'Revisa el código: tiene 16 letras y números (sin 0 ni O).';
    case 'bad-pin':
      return result.message;
    case 'no-owner':
      return 'Esa cuenta ya no es propietaria. Elige otra.';
    case 'missing':
      return NO_RECOVERY_MESSAGE;
  }
}
