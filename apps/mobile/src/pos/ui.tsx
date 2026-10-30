import { View, Text } from 'react-native';
import { format, type Minor } from '@surtivox/pos-core';
import { useAppCurrency } from '../appCurrency';
import { currencyConfigForDisplay } from '../branding';
import { useTheme } from '../theme';

export function useMoney(): (m: Minor) => string {
  const code = useAppCurrency((s) => s.code);
  const currency = currencyConfigForDisplay(code);
  return (m: Minor) => format(m, currency);
}

export const PAYMENT_LABEL: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', wallet: 'Nequi / Daviplata', bank: 'Transferencia', credit: 'Fiado' };

/** Label/value row used in the checkout sheet and receipt. */
export function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ color: t.muted }}>{label}</Text>
      <Text style={{ color: t.fg, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
