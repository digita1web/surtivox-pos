import { asMinor, fromMajorString, type CurrencyConfig, type Minor } from '@openpocket/pos-core';

export interface CashSettlement {
  received: Minor;
  change: Minor;
  enough: boolean;
}

export function settleCash(total: Minor, receivedInput: string, currency: CurrencyConfig): CashSettlement {
  let received = asMinor(0);
  try {
    received = receivedInput ? fromMajorString(receivedInput, currency.decimals) : asMinor(0);
  } catch {
    received = asMinor(0);
  }
  const enough = received >= total;
  return {
    received,
    change: asMinor(enough ? received - total : 0),
    enough,
  };
}
