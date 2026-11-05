export const RECOVERY_ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const RECOVERY_LENGTH = 16;

export function recoveryCodeFromBytes(bytes: ArrayLike<number>): string {
  if (bytes.length < RECOVERY_LENGTH) throw new Error('Faltan bytes aleatorios para el código');
  let code = '';
  for (let i = 0; i < RECOVERY_LENGTH; i++) code += RECOVERY_ALPHABET[(bytes[i]! & 0xff) % RECOVERY_ALPHABET.length];
  return code;
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^0-9a-zA-Z]/g, '').toUpperCase().replace(/[IL]/g, '1');
}

export function isWellFormedRecoveryCode(code: string): boolean {
  if (code.length !== RECOVERY_LENGTH) return false;
  for (const char of code) if (!RECOVERY_ALPHABET.includes(char)) return false;
  return true;
}

export function formatRecoveryCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

export function recoveryShareMessage(storeName: string, code: string): string {
  return `Código de recuperación de ${storeName} (Surtivox POS): ${code}\nGuárdalo en un lugar seguro. Quien lo tenga puede cambiar el PIN del propietario.`;
}
