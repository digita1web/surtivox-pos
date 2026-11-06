import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { checkForUpdate, checkForUpdateNow, dismissUpdateNotice, installedVersionText } from '../updateCheck';
import { describeUpdateResult, type UpdateCheckMessage, type UpdateNotice } from '../appUpdate';
import { useTheme, space, radius } from '../theme';

export function useUpdateNotice() {
  const [notice, setNotice] = useState<UpdateNotice | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    checkForUpdate().then((value) => { if (active) setNotice(value); }).catch(() => {});
    return () => { active = false; };
  }, []));

  const dismiss = useCallback(() => {
    if (!notice) return;
    const current = notice;
    setNotice(null);
    void dismissUpdateNotice(current).catch(() => {});
  }, [notice]);

  return { notice, dismiss };
}

export function UpdateNoticeCard({ notice, onDismiss }: { notice: UpdateNotice; onDismiss: () => void }) {
  const t = useTheme();
  const open = () => { void Linking.openURL(notice.apkUrl ?? notice.htmlUrl).catch(() => {}); };
  return (
    <View style={[s.card, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
      <View style={s.row}>
        <Ionicons name="arrow-down-circle-outline" size={22} color={t.accent} />
        <View style={s.text}>
          <Text style={{ color: t.fg, fontWeight: '800' }}>{`Hay una versión nueva (${notice.version})`}</Text>
          <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>Puedes seguir usando la app mientras tanto.</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
          <Ionicons name="close" size={18} color={t.faint} />
        </Pressable>
      </View>
      <Pressable onPress={open} accessibilityRole="button" style={[s.button, { backgroundColor: t.accent }]}>
        <Text style={{ color: t.accentFg, fontWeight: '800' }}>Descargar</Text>
      </Pressable>
    </View>
  );
}

export function UpdateCheckCard() {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UpdateCheckMessage | null>(null);

  const search = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setMessage(describeUpdateResult(await checkForUpdateNow()));
    } finally {
      setBusy(false);
    }
  };

  const notice = message?.notice ?? null;

  return (
    <View style={[s.checkCard, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={s.row}>
        <Ionicons name="phone-portrait-outline" size={20} color={t.accent} />
        <View style={s.text}>
          <Text style={{ color: t.fg, fontWeight: '800' }} maxFontSizeMultiplier={1.3}>{`Versión instalada: ${installedVersionText()}`}</Text>
          {message ? (
            <Text style={{ color: notice ? t.accent : t.muted, fontSize: 13, marginTop: 2, fontWeight: notice ? '700' : '400' }} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite">{message.headline}</Text>
          ) : null}
        </View>
      </View>
      <View style={s.actions}>
        <Pressable
          onPress={() => void search()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Buscar actualización"
          style={[s.checkButton, { borderColor: t.accent, opacity: busy ? 0.6 : 1 }]}
        >
          {busy ? <ActivityIndicator color={t.accent} /> : <Text style={{ color: t.accent, fontWeight: '800' }} maxFontSizeMultiplier={1.3}>Buscar actualización</Text>}
        </Pressable>
        {notice ? (
          <Pressable
            onPress={() => { void Linking.openURL(notice.apkUrl ?? notice.htmlUrl).catch(() => {}); }}
            accessibilityRole="button"
            accessibilityLabel="Descargar la versión nueva"
            style={[s.checkButton, { backgroundColor: t.accent, borderColor: t.accent }]}
          >
            <Text style={{ color: t.accentFg, fontWeight: '800' }} maxFontSizeMultiplier={1.3}>Descargar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  checkCard: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  checkButton: { minHeight: 44, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, marginHorizontal: space.sm },
  button: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 9, marginTop: space.sm },
});
