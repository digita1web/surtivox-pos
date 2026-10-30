import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fromMajorString, asMinor, type Minor } from '@surtivox/pos-core';
import { getCustomer, customerLedger, recordCustomerPayment, type Customer, type LedgerEntry } from '../../src/repos';
import { useSession, currencyOf } from '../../src/session';
import { useMoney } from '../../src/pos/ui';
import { useTheme, initials, space, radius, type as ty, type Theme } from '../../src/theme';
import { Screen, listProps } from '../../src/pos/Screen';
import { PrimaryButton } from '../../src/pos/kit';
import { showAlert } from '../../src/pos/alert';
import { buildFiadoReminderUrl, normalizeWhatsAppPhone } from '../../src/fiadoReminder';
import { incrementReminderCount } from '../../src/fiadoReminderStorage';

const LEDGER_META: Record<LedgerEntry['type'], { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  sale: { label: 'Venta fiada', icon: 'cart-outline' },
  payment: { label: 'Pago recibido', icon: 'cash-outline' },
  refund: { label: 'Devolución', icon: 'arrow-undo-outline' },
  adjustment: { label: 'Ajuste', icon: 'create-outline' },
};

export default function CustomerDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useSession((s) => s.store)!;
  const money = useMoney();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    getCustomer(id).then(setCustomer);
    customerLedger(id).then(setLedger);
  }, [id]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (!customer) return <Screen title="Cliente" scroll={false}><View /></Screen>;

  const payFooter = customer.balance > 0 ? (
    <PrimaryButton label="Registrar pago" icon="cash-outline" onPress={() => setPayOpen(true)} />
  ) : undefined;

  const remind = () => {
    if (!customer.phone) return;
    const phone = normalizeWhatsAppPhone(customer.phone);
    if (!phone) {
      showAlert('Teléfono inválido', 'El teléfono no es un celular colombiano válido.');
      return;
    }
    const url = buildFiadoReminderUrl(customer.name, money(asMinor(customer.balance)), phone);
    Linking.openURL(url)
      .then(() => incrementReminderCount())
      .catch((e) => showAlert('No se pudo abrir WhatsApp', e instanceof Error ? e.message : String(e)));
  };

  return (
    <Screen title={customer.name} subtitle={customer.phone || undefined} scroll={false} footer={payFooter}>
      <FlatList
        {...listProps}
        data={ledger}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: payFooter ? space.xl : insets.bottom + space.xxl }}
        ListHeaderComponent={
          <>
            <View style={[s.balCard, { backgroundColor: customer.balance > 0 ? t.accent : t.panel, borderColor: t.line }]}>
              <View style={[s.avatar, { backgroundColor: customer.balance > 0 ? 'rgba(255,255,255,0.2)' : t.accent }]}>
                <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 18 }}>{initials(customer.name)}</Text>
              </View>
              <Text style={{ color: customer.balance > 0 ? t.accentFg : t.muted, marginTop: 12, fontSize: 13 }}>
                {customer.balance > 0 ? 'Saldo pendiente' : 'Saldo'}
              </Text>
              <Text style={{ color: customer.balance > 0 ? t.accentFg : t.fg, fontSize: 30, fontWeight: '800', marginTop: 2 }}>
                {money(asMinor(customer.balance))}
              </Text>
              {customer.phone ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Ionicons name="call-outline" size={14} color={customer.balance > 0 ? t.accentFg : t.muted} />
                  <Text style={{ color: customer.balance > 0 ? t.accentFg : t.muted, fontSize: 13 }}>{customer.phone}</Text>
                </View>
              ) : null}
              {customer.balance > 0 && customer.phone ? (
                <Pressable onPress={remind} style={s.reminder}>
                  <Ionicons name="logo-whatsapp" size={16} color={t.accentFg} />
                  <Text style={{ color: t.accentFg, fontWeight: '700', marginLeft: 6 }}>Recordar por WhatsApp</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={[ty.h2, s.section, { color: t.fg }]}>Historial</Text>
          </>
        }
        ListEmptyComponent={<Text style={[ty.body, { color: t.muted, textAlign: 'center', marginTop: space.xl }]}>Aún no hay movimientos.</Text>}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => {
          const meta = LEDGER_META[item.type];
          const positive = item.amount > 0; // owes more
          return (
            <View style={[s.entry, { borderColor: t.line, backgroundColor: t.panel }]}>
              <View style={[s.entryIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name={meta.icon} size={18} color={t.muted} /></View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={[ty.body, { color: t.fg, fontWeight: '600' }]}>{meta.label}</Text>
                <Text style={[ty.small, { color: t.muted, marginTop: 2 }]}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={{ color: positive ? t.danger : t.ok, fontWeight: '800' }}>
                {positive ? '+' : '−'}{money(asMinor(Math.abs(item.amount)))}
              </Text>
            </View>
          );
        }}
      />

      <PaymentModal
        visible={payOpen} onClose={() => setPayOpen(false)} t={t}
        max={customer.balance} decimals={currencyOf(store).decimals}
        onSubmit={async (amt) => { await recordCustomerPayment(store.id, customer.id, amt); setPayOpen(false); refresh(); }}
      />
    </Screen>
  );
}

function PaymentModal({ visible, onClose, onSubmit, t, max, decimals }: {
  visible: boolean; onClose: () => void; onSubmit: (amt: Minor) => Promise<void>; t: Theme; max: number; decimals: number;
}) {
  const money = useMoney();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = (() => { try { return amount ? fromMajorString(amount, decimals) : asMinor(0); } catch { return asMinor(0); } })();
  const valid = parsed > 0 && parsed <= max;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { await onSubmit(parsed); setAmount(''); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.sheet, { backgroundColor: t.panel, paddingBottom: insets.bottom + space.xl }]}>
          <View style={[s.grabber, { backgroundColor: t.line }]} />
          <View style={s.headRow}>
            <Text style={{ color: t.fg, fontSize: 19, fontWeight: '800' }}>Registrar pago</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={t.muted} /></Pressable>
          </View>
          <Text style={{ color: t.muted, marginTop: 4 }}>Saldo pendiente {money(asMinor(max))}</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={t.muted}
            style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setAmount((max / 10 ** decimals).toFixed(decimals))} style={[s.pill, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
              <Text style={{ color: t.fg, fontWeight: '600' }}>Pagar todo · {money(asMinor(max))}</Text>
            </Pressable>
          </View>
          <Pressable onPress={submit} disabled={!valid || busy} style={[s.primary, { backgroundColor: t.accent, opacity: !valid || busy ? 0.5 : 1 }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>{busy ? 'Guardando…' : 'Confirmar pago'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  balCard: { borderWidth: 1, borderRadius: radius.lg, padding: space.xl, alignItems: 'center' },
  reminder: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  avatar: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: space.xl, marginBottom: space.sm },
  entry: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: radius.lg },
  entryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10, paddingBottom: 28 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, fontWeight: '700', marginTop: 14 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 10 },
  primary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
});
