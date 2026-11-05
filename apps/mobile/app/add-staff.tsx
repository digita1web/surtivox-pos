import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';
import { getStore, listStaff, createStaff, updateStaff, setupRecovery, type Store } from '../src/repos';
import { RecoveryCodeSheet } from '../src/pos/RecoveryCodeSheet';
import { showAlert } from '../src/pos/alert';
import { ROLES, ROLE_LABEL, roleSummary, type Role } from '../src/roles';
import { validatePin, validateStaffName, MAX_STAFF_NAME } from '../src/staffRules';
import { useSession } from '../src/session';
import { useTheme, space, radius } from '../src/theme';

export default function AddStaff() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string; role?: Role }>();
  const editing = !!params.id;
  const refreshStaffCount = useSession((s) => s.refreshStaffCount);
  const signIn = useSession((s) => s.signIn);
  const me = useSession((s) => s.staff);

  const [store, setStore] = useState<Store | null>(null);
  const [firstEver, setFirstEver] = useState(false);
  const [otherNames, setOtherNames] = useState<string[]>([]);
  const [onlyOwner, setOnlyOwner] = useState(false);
  const [name, setName] = useState(params.name ?? '');
  const [role, setRole] = useState<Role>(params.role ?? 'cashier');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getStore().then(async (st) => {
      setStore(st);
      if (!st) return;
      const existing = await listStaff(st.id);
      setOtherNames(existing.filter((m) => m.id !== params.id).map((m) => m.name));
      if (!editing && existing.length === 0) { setFirstEver(true); setRole('owner'); }
      if (editing) {
        const owners = existing.filter((m) => m.role === 'owner');
        setOnlyOwner(owners.length <= 1 && owners.some((m) => m.id === params.id));
      }
    });
  }, []);

  const save = async () => {
    if (!store || busy) return;
    setErr(null);
    const nameError = validateStaffName(name, otherNames);
    if (nameError) { setErr(nameError); return; }
    // PIN required on create; optional on edit (blank = keep existing).
    const changingPin = pin.length > 0 || confirm.length > 0 || !editing;
    if (changingPin) {
      const pinError = validatePin(pin, confirm);
      if (pinError) { setErr(pinError); return; }
    }
    setBusy(true);
    try {
      if (editing) {
        await updateStaff({ id: params.id!, name, role, pin: pin || undefined });
        await refreshStaffCount();
        if (me && me.id === params.id) signIn({ ...me, name: name.replace(/\s+/g, ' ').trim(), role });
      } else {
        const id = await createStaff({ storeId: store.id, name, role, pin });
        if (firstEver) {
          signIn({ id, name: name.replace(/\s+/g, ' ').trim(), role, created_at: Date.now() });
          await refreshStaffCount();
          try {
            setRecoveryCode(await setupRecovery(store.id));
            setBusy(false);
            return;
          } catch {
            showAlert('No se pudo crear el código de recuperación', 'Puedes generarlo después en Personal y roles.');
          }
        } else {
          await refreshStaffCount();
        }
      }
      router.back();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <Screen title={editing ? 'Editar personal' : 'Nuevo personal'}
      footer={<PrimaryButton label={editing ? 'Guardar cambios' : 'Agregar personal'} onPress={save} busy={busy} disabled={!store} />}>
      <Text style={[st.label, { color: t.muted }]}>Nombre</Text>
      <TextInput value={name} onChangeText={setName} maxLength={MAX_STAFF_NAME} placeholder="ej. Camila Rodríguez" placeholderTextColor={t.muted} accessibilityLabel="Nombre"
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />

      <Text style={[st.label, { color: t.muted }]}>Rol</Text>
      {firstEver && <Text style={{ color: t.muted, fontSize: 12, marginBottom: space.sm }}>La primera cuenta debe ser del propietario.</Text>}
      {onlyOwner && <Text style={{ color: t.muted, fontSize: 12, marginBottom: space.sm }}>Es el único propietario: su rol no se puede cambiar. Primero agrega otro propietario.</Text>}
      <View style={st.roleRow}>
        {ROLES.map((r) => {
          const on = role === r;
          const disabled = (firstEver || onlyOwner) && r !== 'owner';
          return (
            <Pressable key={r} onPress={() => !disabled && setRole(r)} disabled={disabled} accessibilityRole="radio" accessibilityState={{ selected: on, disabled }}
              style={[st.rolePill, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.panel, opacity: disabled ? 0.4 : 1 }]}>
              <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700' }}>{ROLE_LABEL[r]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: space.sm }}>{roleSummary(role)}</Text>

      <Text style={[st.label, { color: t.muted }]}>{editing ? 'PIN de 4 dígitos (déjalo vacío para conservarlo)' : 'PIN de 4 dígitos'}</Text>
      <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 8 }]} />

      <Text style={[st.label, { color: t.muted }]}>Confirmar PIN</Text>
      <TextInput value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 8 }]} />

      {err && <Text style={{ color: t.dangerText, marginTop: space.lg }}>{err}</Text>}
      <RecoveryCodeSheet visible={recoveryCode !== null} code={recoveryCode ?? ''} storeName={store?.name ?? 'tu tienda'} onDone={() => { setRecoveryCode(null); router.back(); }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  roleRow: { flexDirection: 'row', gap: space.sm },
  rolePill: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingVertical: 12 },
});
