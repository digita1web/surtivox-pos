import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import { CURRENCIES, currencyConfigForDisplay } from './branding';

const FILE_URI = FileSystem.documentDirectory + 'app-currency.json';

interface AppCurrencyState {
  code: string;
  loaded: boolean;
}

export const useAppCurrency = create<AppCurrencyState>(() => ({ code: 'COP', loaded: false }));

function normalizeCurrency(code: string | null | undefined): string {
  return CURRENCIES.some((c) => c.code === code) ? code! : 'COP';
}

export function appCurrencyConfig(): { code: string; locale: string; decimals: number } {
  return currencyConfigForDisplay(useAppCurrency.getState().code);
}

export async function loadAppCurrency(fallbackCode: string): Promise<void> {
  let code = normalizeCurrency(fallbackCode);
  try {
    const raw = await FileSystem.readAsStringAsync(FILE_URI, { encoding: FileSystem.EncodingType.UTF8 });
    const parsed = JSON.parse(raw);
    if (typeof parsed?.code === 'string') code = normalizeCurrency(parsed.code);
  } catch {}
  useAppCurrency.setState({ code, loaded: true });
}

export async function setAppCurrency(code: string): Promise<void> {
  const next = normalizeCurrency(code);
  useAppCurrency.setState({ code: next, loaded: true });
  try {
    await FileSystem.writeAsStringAsync(FILE_URI, JSON.stringify({ code: next }), { encoding: FileSystem.EncodingType.UTF8 });
  } catch {}
}

export async function resetAppCurrency(): Promise<void> {
  useAppCurrency.setState({ code: 'COP', loaded: true });
  try {
    await FileSystem.deleteAsync(FILE_URI, { idempotent: true });
  } catch {}
}
