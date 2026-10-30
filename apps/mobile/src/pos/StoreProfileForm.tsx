/**
 * Shared shop-profile UI: used by onboarding (two steps) and by
 * More → Shop profile & receipts. Three pieces:
 *   ShopDetailsFields  logo, name, tagline, phone, email, website, address, tax id
 *   ReceiptFields      paper size, accent color, footer, terms, what to show
 *   ReceiptPreview     a live mock receipt that follows every change
 */
import { View, Text, TextInput, Pressable, Switch, Image, StyleSheet } from 'react-native';
import { showAlert } from './alert';
import { Ionicons } from '@expo/vector-icons';
import { asMinor, format, type CurrencyConfig } from '@surtivox/pos-core';
import type { StoreProfile, ReceiptPaper } from '../repos';
import { pickLogo } from './images';
import { useTheme, type Theme } from '../theme';
import {
  ACCENT_PRESETS, PAPER_OPTIONS, safeAccent, onAccent, contactLines, shopInitials,
  DEFAULT_FOOTER, DEFAULT_RECEIPT_TERMS, localizedReceiptFooter, localizedReceiptTerms,
} from '../branding';

type Props = { value: StoreProfile; onChange: (patch: Partial<StoreProfile>) => void };

const PAPER_LABEL_ES: Record<ReceiptPaper, { label: string; hint: string }> = {
  a4: { label: 'Factura A4', hint: 'Página completa, láser / PDF' },
  thermal80: { label: '80 mm', hint: 'Rollo térmico' },
  thermal58: { label: '58 mm', hint: 'Rollo térmico pequeño' },
};

function Label({ t, children }: { t: Theme; children: string }) {
  return <Text style={[s.label, { color: t.muted }]}>{children}</Text>;
}

function Field({ t, label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize }: {
  t: Theme; label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'url'; autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <>
      <Label t={t}>{label}</Label>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.muted}
        multiline={multiline} keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? (keyboardType && keyboardType !== 'default' ? 'none' : 'sentences')}
        style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }, multiline && { minHeight: 76, textAlignVertical: 'top' }]}
      />
    </>
  );
}

/** Logo picker: tap to choose, ✕ to remove. Falls back to the shop initials. */
function LogoPicker({ t, value, onChange }: Props & { t: Theme }) {
  const choose = async () => {
    try {
      const uri = await pickLogo();
      if (uri) onChange({ logoUri: uri });
    } catch (e) { showAlert('No se pudo elegir el logo', e instanceof Error ? e.message : String(e)); }
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable onPress={choose}>
        {value.logoUri ? (
          <Image source={{ uri: value.logoUri }} style={[s.logo, { borderColor: t.line, backgroundColor: '#fff' }]} resizeMode="contain" />
        ) : (
          <View style={[s.logo, s.logoEmpty, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
            <Ionicons name="image-outline" size={28} color={t.muted} />
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Agregar logo</Text>
          </View>
        )}
        {value.logoUri ? (
          <Pressable onPress={() => onChange({ logoUri: null })} hitSlop={10} style={[s.remove, { backgroundColor: t.danger }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
          </Pressable>
        ) : null}
      </Pressable>
      <Text style={{ color: t.faint, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
        Se muestra en recibos y facturas. Es opcional: si no lo agregas, se usan las iniciales de tu tienda.
      </Text>
    </View>
  );
}

export function ShopDetailsFields({ value, onChange }: Props) {
  const t = useTheme();
  return (
    <View>
      <LogoPicker t={t} value={value} onChange={onChange} />
      <Field t={t} label="Nombre de la tienda" value={value.name} onChangeText={(name) => onChange({ name })} placeholder="ej. Mercado Fresco" />
      <Field t={t} label="Eslogan (opcional)" value={value.tagline} onChangeText={(tagline) => onChange({ tagline })} placeholder="ej. Abarrotes frescos, precios justos" />
      <Field t={t} label="Teléfono" value={value.phone} onChangeText={(phone) => onChange({ phone })} placeholder="ej. +57 300 123 4567" keyboardType="phone-pad" />
      <Field t={t} label="Correo electrónico" value={value.email} onChangeText={(email) => onChange({ email })} placeholder="tienda@ejemplo.com" keyboardType="email-address" />
      <Field t={t} label="Sitio web o red social" value={value.website} onChangeText={(website) => onChange({ website })} placeholder="www.ejemplo.com o @tutienda" keyboardType="url" />
      <Field t={t} label="Dirección" value={value.address} onChangeText={(address) => onChange({ address })} placeholder="Calle, barrio, ciudad" multiline />
      <Field t={t} label="NIT / RUT (opcional)" value={value.taxId} onChangeText={(taxId) => onChange({ taxId })} placeholder="Se imprime en los recibos si lo indicas" autoCapitalize="none" />
    </View>
  );
}

function Toggle({ t, label, hint, on, onValueChange }: { t: Theme; label: string; hint?: string; on: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ color: t.fg, fontWeight: '600' }}>{label}</Text>
        {hint ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch value={on} onValueChange={onValueChange} trackColor={{ true: t.accent, false: t.line }} thumbColor="#fff" />
    </View>
  );
}

export function ReceiptFields({ value, onChange }: Props) {
  const t = useTheme();
  const accent = safeAccent(value.receiptAccent);
  return (
    <View>
      <Label t={t}>Tamaño del papel</Label>
      <View style={s.wrap}>
        {PAPER_OPTIONS.map((o) => {
          const on = value.receiptPaper === o.key;
          const copy = PAPER_LABEL_ES[o.key];
          return (
            <Pressable key={o.key} onPress={() => onChange({ receiptPaper: o.key as ReceiptPaper })}
              style={[s.paper, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel }]}>
              <Text style={{ color: on ? t.accent : t.fg, fontWeight: '700' }}>{copy.label}</Text>
              <Text style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>{copy.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label t={t}>Color del recibo</Label>
      <View style={s.wrap}>
        {ACCENT_PRESETS.map((c) => {
          const on = accent === c;
          return (
            <Pressable key={c} onPress={() => onChange({ receiptAccent: c })}
              style={[s.swatch, { backgroundColor: c, borderColor: on ? t.fg : 'transparent' }]}>
              {on ? <Ionicons name="checkmark" size={18} color={onAccent(c)} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Field t={t} label="Mensaje de agradecimiento" value={value.receiptFooter} onChangeText={(receiptFooter) => onChange({ receiptFooter })}
        placeholder={DEFAULT_FOOTER} multiline />
      <Field t={t} label="Términos / política de devoluciones (opcional)" value={value.receiptTerms} onChangeText={(receiptTerms) => onChange({ receiptTerms })}
        placeholder={DEFAULT_RECEIPT_TERMS} multiline />

      <Label t={t}>Mostrar en el recibo</Label>
      <View style={[s.card, { borderColor: t.line, backgroundColor: t.panel }]}>
        <Toggle t={t} label="Logo" on={value.showLogo} onValueChange={(showLogo) => onChange({ showLogo })} />
        <View style={[s.sep, { backgroundColor: t.line }]} />
        <Toggle t={t} label="Datos de contacto" hint="Dirección, teléfono, correo, sitio web" on={value.showContact} onValueChange={(showContact) => onChange({ showContact })} />
        <View style={[s.sep, { backgroundColor: t.line }]} />
        <Toggle t={t} label="Atendido por" hint="Nombre del cajero que realizó la venta" on={value.showStaff} onValueChange={(showStaff) => onChange({ showStaff })} />
      </View>
    </View>
  );
}

/** A mock receipt that mirrors print.ts closely enough to judge the design. */
export function ReceiptPreview({ value, currency }: { value: StoreProfile; currency: CurrencyConfig }) {
  const t = useTheme();
  const accent = safeAccent(value.receiptAccent);
  const fg = onAccent(accent);
  const thermal = value.receiptPaper !== 'a4';
  const narrow = value.receiptPaper === 'thermal58';
  const m = (n: number) => format(asMinor(n), currency);
  const contact = value.showContact ? contactLines(value) : [];
  const mono = thermal ? { fontFamily: 'monospace' as const } : null;
  const name = value.name.trim() || 'Nombre de tu tienda';
  const footer = localizedReceiptFooter(value.receiptFooter);
  const termsText = localizedReceiptTerms(value.receiptTerms);

  const logo = value.showLogo ? (
    value.logoUri
      ? <Image source={{ uri: value.logoUri }} style={p.logoImg} resizeMode="contain" />
      : <View style={[p.logoMono, { backgroundColor: accent }]}><Text style={{ color: fg, fontWeight: '800', fontSize: 15 }}>{shopInitials(name)}</Text></View>
  ) : null;

  const rows: [string, number, number][] = [['Artículo de ejemplo', 2, 5000], ['Otro artículo', 1, 12000]];
  const sub = 22000; const tax = 400; const total = sub + tax;

  return (
    <View style={[p.paper, { width: narrow ? 200 : thermal ? 250 : '100%', alignSelf: 'center', borderColor: t.line }]}>
      <View style={thermal ? p.headC : p.headRow}>
        <View style={[thermal ? { alignItems: 'center' } : { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }]}>
          {logo}
          <View style={thermal ? { alignItems: 'center' } : { flex: 1 }}>
            <Text style={[p.name, mono]} numberOfLines={2}>{name}</Text>
            {value.tagline.trim() ? <Text style={[p.small, mono]}>{value.tagline.trim()}</Text> : null}
            {contact.map((c, i) => <Text key={i} style={[p.small, mono]}>{c}</Text>)}
            {value.taxId.trim() ? <Text style={[p.small, mono, { fontWeight: '700' }]}>NIT: {value.taxId.trim()}</Text> : null}
          </View>
        </View>
        {!thermal && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: accent, fontWeight: '800', fontSize: 16, letterSpacing: 1 }}>RECIBO</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#111827' }}>INV-0001</Text>
          </View>
        )}
      </View>
      <View style={[p.rule, { borderColor: thermal ? '#000' : accent, borderStyle: thermal ? 'dashed' : 'solid', borderTopWidth: thermal ? 1 : 2 }]} />
      {thermal && <Text style={[p.small, mono, { textAlign: 'center', fontWeight: '800', color: '#000' }]}>RECIBO INV-0001</Text>}
      <Text style={[p.small, mono, { color: '#6b7280' }]}>{new Date().toLocaleDateString('es-CO')}{value.showStaff ? '  ·  Atendido por Ana' : ''}</Text>

      {rows.map(([n, q, price]) => (
        <View key={n} style={p.line}>
          <Text style={[p.txt, mono, { flex: 1 }]} numberOfLines={1}>{n} × {q}</Text>
          <Text style={[p.txt, mono]}>{m(q * price)}</Text>
        </View>
      ))}
      <View style={[p.rule, { borderColor: '#d1d5db', borderStyle: 'dashed' }]} />
      <View style={p.line}><Text style={[p.txt, mono, { color: '#6b7280' }]}>Subtotal</Text><Text style={[p.txt, mono]}>{m(sub)}</Text></View>
      <View style={p.line}><Text style={[p.txt, mono, { color: '#6b7280' }]}>Impuesto</Text><Text style={[p.txt, mono]}>{m(tax)}</Text></View>
      <View style={p.line}>
        <Text style={[p.total, mono, { color: thermal ? '#000' : accent }]}>Total</Text>
        <Text style={[p.total, mono, { color: thermal ? '#000' : accent }]}>{m(total)}</Text>
      </View>
      <View style={[p.rule, { borderColor: '#d1d5db', borderStyle: 'dashed' }]} />
      <Text style={[p.foot, mono]}>{footer}</Text>
      <Text style={[p.terms, mono]}>{termsText}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16 },
  logo: { width: 96, height: 96, borderRadius: 24, borderWidth: 1 },
  logoEmpty: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  remove: { position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paper: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minWidth: 104 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  sep: { height: StyleSheet.hairlineWidth },
});

const p = StyleSheet.create({
  paper: { backgroundColor: '#ffffff', borderWidth: 1, borderRadius: 10, padding: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  headC: { alignItems: 'center' },
  logoImg: { width: 48, height: 48, borderRadius: 8 },
  logoMono: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  name: { fontSize: 16, fontWeight: '800', color: '#111827' },
  small: { fontSize: 10.5, color: '#4b5563', marginTop: 1 },
  rule: { marginVertical: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, gap: 8 },
  txt: { fontSize: 12, color: '#111827' },
  total: { fontSize: 15, fontWeight: '800' },
  foot: { textAlign: 'center', fontWeight: '700', fontSize: 12, color: '#111827' },
  terms: { textAlign: 'center', fontSize: 9.5, color: '#6b7280', marginTop: 6 },
});
