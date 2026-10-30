import type { Minor } from '@surtivox/pos-core';

export function formatCopAmount(amount: Minor): string {
  if (!Number.isSafeInteger(amount)) throw new RangeError('La cantidad COP debe ser un entero');
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(amount));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$ ${grouped}`;
}
