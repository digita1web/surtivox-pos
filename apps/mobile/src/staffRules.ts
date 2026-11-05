export const MAX_STAFF_NAME = 40;
export const FREE_ATTEMPTS = 5;
export const MAX_LOCKOUT_MS = 15 * 60_000;
export const GUARD_MEMORY_MS = 12 * 3_600_000;
export const DEFAULT_AUTO_LOCK_MINUTES = 5;

export const AUTO_LOCK_OPTIONS = [
  { minutes: 0, label: 'Nunca' },
  { minutes: 1, label: '1 min' },
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min' },
] as const;

export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function validateStaffName(name: string, otherNames: readonly string[]): string | null {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!clean) return 'El nombre es obligatorio';
  if (clean.length > MAX_STAFF_NAME) return `El nombre no puede pasar de ${MAX_STAFF_NAME} caracteres`;
  const key = normalizeName(clean);
  if (otherNames.some((other) => normalizeName(other) === key)) return 'Ya hay una persona con ese nombre';
  return null;
}

export function isWeakPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false;
  const digits = pin.split('').map(Number) as [number, number, number, number];
  if (digits.every((d) => d === digits[0])) return true;
  const steps = [digits[1] - digits[0], digits[2] - digits[1], digits[3] - digits[2]];
  if (steps.every((step) => step === 1) || steps.every((step) => step === -1)) return true;
  return digits[0] === digits[2] && digits[1] === digits[3];
}

export function validatePin(pin: string, confirm: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'El PIN debe tener exactamente 4 dígitos';
  if (pin !== confirm) return 'Los PIN no coinciden';
  if (isWeakPin(pin)) return 'Ese PIN es muy fácil de adivinar (como 0000, 1234 o 1212). Elige otro';
  return null;
}

export interface PinGuard {
  failures: number;
  lockedUntil: number;
  lastAt: number;
}

export const CLEAN_GUARD: PinGuard = { failures: 0, lockedUntil: 0, lastAt: 0 };

export function parseGuard(raw: string | null): PinGuard {
  if (!raw) return CLEAN_GUARD;
  try {
    const parsed = JSON.parse(raw) as Partial<PinGuard>;
    const numbers = [parsed.failures, parsed.lockedUntil, parsed.lastAt];
    if (numbers.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return CLEAN_GUARD;
    return { failures: Math.floor(parsed.failures!), lockedUntil: parsed.lockedUntil!, lastAt: parsed.lastAt! };
  } catch {
    return CLEAN_GUARD;
  }
}

export function lockoutMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_LOCKOUT_MS, 30_000 * 2 ** (failures - FREE_ATTEMPTS));
}

export function effectiveFailures(guard: PinGuard, now: number): number {
  return now - guard.lastAt > GUARD_MEMORY_MS ? 0 : guard.failures;
}

export function remainingLockMs(guard: PinGuard, now: number): number {
  return Math.max(0, guard.lockedUntil - now);
}

export function registerFailure(guard: PinGuard, now: number): PinGuard {
  const failures = effectiveFailures(guard, now) + 1;
  const wait = lockoutMs(failures);
  return { failures, lockedUntil: wait > 0 ? now + wait : 0, lastAt: now };
}

export function attemptsLeft(guard: PinGuard, now: number): number {
  return Math.max(0, FREE_ATTEMPTS - effectiveFailures(guard, now));
}

export function formatWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function parseAutoLock(raw: string | null): number {
  if (raw === null) return DEFAULT_AUTO_LOCK_MINUTES;
  const minutes = Number(raw);
  return AUTO_LOCK_OPTIONS.some((option) => option.minutes === minutes) ? minutes : DEFAULT_AUTO_LOCK_MINUTES;
}

export function shouldAutoLock(input: { backgroundedAt: number | null; now: number; minutes: number }): boolean {
  if (input.minutes <= 0 || input.backgroundedAt === null) return false;
  return input.now - input.backgroundedAt >= input.minutes * 60_000;
}
