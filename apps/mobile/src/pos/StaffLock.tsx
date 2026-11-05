import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listStaff, attemptStaffPin, staffLockRetryAt, type Staff } from '../repos';
import { formatWait } from '../staffRules';
import { ForgotPinSheet } from './ForgotPinSheet';
import { ROLE_LABEL } from '../roles';
import { useSession } from '../session';
import { useTheme, initials, tileColor } from '../theme';

/** Full-screen PIN gate shown when staff exist but none is signed in. */
export function StaffLock() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const store = useSession((s) => s.store)!;
  const signIn = useSession((s) => s.signIn);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [picked, setPicked] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => { listStaff(store.id).then(setStaff); }, [store.id]);

  const waitMs = Math.max(0, retryAt - now);
  const locked = waitMs > 0;
  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [locked]);

  const choose = async (member: Staff) => {
    setPin('');
    setNote(null);
    const until = await staffLockRetryAt(member.id).catch(() => null);
    setNow(Date.now());
    setRetryAt(until ?? 0);
    setPicked(member);
  };

  const fail = () => {
    setError(true);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    setTimeout(() => { setPin(''); setError(false); }, 400);
  };

  const press = async (d: string) => {
    if (!picked || pin.length >= 4 || error || locked) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      const result = await attemptStaffPin(picked.id, next);
      if (result.status === 'ok') { signIn(result.staff); return; }
      if (result.status === 'locked') {
        setNow(Date.now());
        setRetryAt(result.retryAt);
        setNote(null);
      } else if (result.status === 'wrong') {
        setNote(result.attemptsLeft <= 2 ? `Te quedan ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'intento' : 'intentos'} antes de un bloqueo temporal.` : null);
      } else {
        setNote('Esta cuenta ya no existe. Vuelve atrás.');
      }
      fail();
    }
  };

  const owners = staff.filter((m) => m.role === 'owner');
  const forgotSheet = (
    <ForgotPinSheet
      visible={forgot}
      storeId={store.id}
      storeName={store.name}
      owners={owners}
      initialOwnerId={picked?.role === 'owner' ? picked.id : undefined}
      onClose={() => setForgot(false)}
      onRecovered={(owner) => signIn(owner)}
    />
  );

  // Staff picker
  if (!picked) {
    return (
      <View style={[st.root, { backgroundColor: t.bg, paddingTop: insets.top + 60 }]}>
        {store.logo_uri ? (
          <Image source={{ uri: store.logo_uri }} style={[st.badge, { backgroundColor: '#fff', borderWidth: 1, borderColor: t.line }]} resizeMode="contain" />
        ) : (
          <View style={[st.badge, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 22 }}>{initials(store.name)}</Text>
          </View>
        )}
        <Text style={[st.title, { color: t.fg }]}>¿Quién está trabajando?</Text>
        <Text style={[st.sub, { color: t.muted }]}>Toca tu nombre para entrar</Text>
        <View style={st.grid}>
          {staff.map((m) => (
            <Pressable key={m.id} onPress={() => { void choose(m); }} style={st.person} accessibilityRole="button" accessibilityLabel={`${m.name}, ${ROLE_LABEL[m.role]}`}>
              <View style={[st.avatar, { backgroundColor: tileColor(m.id) }]}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20 }}>{initials(m.name)}</Text>
              </View>
              <Text style={{ color: t.fg, fontWeight: '700', marginTop: 8 }} numberOfLines={1}>{m.name}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>{ROLE_LABEL[m.role]}</Text>
            </Pressable>
          ))}
        </View>
        {owners.length > 0 ? (
          <Pressable onPress={() => setForgot(true)} accessibilityRole="button" hitSlop={10} style={st.forgot}>
            <Text style={{ color: t.accent, fontWeight: '800' }}>¿Olvidaste el PIN del propietario?</Text>
          </Pressable>
        ) : null}
        {forgotSheet}
      </View>
    );
  }

  // PIN pad
  return (
    <View style={[st.root, { backgroundColor: t.bg, paddingTop: insets.top + 40 }]}>
      <Pressable onPress={() => { setPicked(null); setPin(''); setNote(null); }} hitSlop={12} style={[st.back, { top: insets.top + 8 }]} accessibilityRole="button" accessibilityLabel="Cambiar de persona">
        <Ionicons name="chevron-back" size={26} color={t.fg} />
      </Pressable>
      <View style={[st.avatar, { backgroundColor: tileColor(picked.id), width: 72, height: 72, borderRadius: 22 }]}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 26 }}>{initials(picked.name)}</Text>
      </View>
      <Text style={[st.title, { color: t.fg, marginTop: 16 }]}>{picked.name}</Text>
      <Text style={[st.sub, { color: locked ? t.dangerText : t.muted }]} accessibilityLiveRegion="polite">
        {locked ? `Demasiados intentos. Intenta de nuevo en ${formatWait(waitMs)}` : 'Ingresa tu PIN de 4 dígitos'}
      </Text>

      <Animated.View style={[st.dots, { transform: [{ translateX: shake }] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[st.dot, {
            borderColor: error ? t.danger : t.line,
            backgroundColor: error ? t.danger : (i < pin.length ? t.accent : 'transparent'),
          }]} />
        ))}
      </Animated.View>

      {note && !locked ? <Text style={{ color: t.dangerText, fontSize: 13, textAlign: 'center', marginTop: -24, marginBottom: 16 }}>{note}</Text> : null}

      <View style={[st.pad, { opacity: locked ? 0.35 : 1 }]} pointerEvents={locked ? 'none' : 'auto'}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => {
          if (k === '') return <View key={i} style={st.key} />;
          if (k === 'del') return (
            <Pressable key={i} style={st.key} onPress={() => setPin((p) => p.slice(0, -1))} hitSlop={4}>
              <Ionicons name="backspace-outline" size={26} color={t.fg} />
            </Pressable>
          );
          return (
            <Pressable key={i} style={({ pressed }) => [st.key, st.keyNum, { backgroundColor: pressed ? t.accentSoft : t.panel, borderColor: t.line }]} onPress={() => press(k)}>
              <Text style={{ color: t.fg, fontSize: 26, fontWeight: '600' }}>{k}</Text>
            </Pressable>
          );
        })}
      </View>
      {picked.role === 'owner' ? (
        <Pressable onPress={() => setForgot(true)} accessibilityRole="button" hitSlop={10} style={st.forgot}>
          <Text style={{ color: t.accent, fontWeight: '800' }}>¿Olvidaste tu PIN?</Text>
        </Pressable>
      ) : null}
      {forgotSheet}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  badge: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', marginTop: 20 },
  sub: { fontSize: 15, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginTop: 40 },
  person: { width: 96, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 16 },
  dots: { flexDirection: 'row', gap: 18, marginTop: 36, marginBottom: 40 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pad: { width: 300, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  key: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  keyNum: { borderRadius: 42, borderWidth: 1 },
  forgot: { marginTop: 28, paddingVertical: 10, paddingHorizontal: 12 },
});
