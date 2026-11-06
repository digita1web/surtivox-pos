import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../src/cart';
import { CATALOG_URL, enqueueContribution, flushOutbox } from '../src/catalog';
import { isCatalogEnabled } from '../src/catalogCore';
import { getDb } from '../src/db';
import { DEVICE_ID, newId } from '../src/id';
import { getLocalSetting, listCategories, type Category, type Product } from '../src/repos';
import { useSession } from '../src/session';
import { radius, space, useTheme } from '../src/theme';
import { showAlert } from '../src/pos/alert';
import { categoryImageFor } from '../src/pos/categoryImages';
import { pickFromGallery, takePhoto } from '../src/pos/images';
import { MarketPricesCompactView } from '../src/pos/MarketPricesCompact';
import { useMarketPrices } from '../src/pos/useMarketPrices';
import {
  advance, back, composeProductName, formatPriceInput, newDraft, normalizeName, progressLabel, skip, stepError, stepNumber,
  validateBrand, validateName, validateSize, WIZARD_STEPS, type WizardDraft,
} from '../src/productWizard';
import { RESUME_LABELS, WELCOME_LABELS, exitAction, resumeOffer, shouldSaveDraft, stepActions } from '../src/productWizardFlow';
import { closingMessage, useWizardHandoff } from '../src/productWizardHandoff';
import { finishWizardOn } from '../src/productWizardFinish';
import { categoryExamplesOn } from '../src/productWizardRepo';
import { discardDraftOn, loadDraftOn, purgeStaleDraftsOn, saveDraftOn } from '../src/productWizardStore';

const fileExists = async (uri: string) => (await FileSystem.getInfoAsync(uri)).exists;

export default function ProductWizard() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { code: rawCode } = useLocalSearchParams<{ code?: string }>();
  const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode)?.trim() ?? '';
  const store = useSession((s) => s.store);
  const cart = useCart();
  const prices = useMarketPrices(code);
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [stored, setStored] = useState<WizardDraft | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [examples, setExamples] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const brandInput = useRef<TextInput>(null);
  const sizeInput = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    const db = getDb();
    void purgeStaleDraftsOn(db, Date.now()).catch(() => {});
    loadDraftOn(db, { now: () => Date.now(), fileExists }, code)
      .then((found) => {
        if (!active) return;
        if (resumeOffer(found) === 'offer') setStored(found);
        setDraft(newDraft(code, Date.now()));
      })
      .catch(() => { if (active) setDraft(newDraft(code, Date.now())); });
    return () => { active = false; };
  }, [code]);

  useEffect(() => {
    if (!store) return;
    let active = true;
    listCategories(store.id).then((list) => { if (active) setCategories(list); }).catch(() => {});
    categoryExamplesOn(getDb(), store.id).then((map) => { if (active) setExamples(map); }).catch(() => {});
    return () => { active = false; };
  }, [store]);

  useEffect(() => {
    if (!draft || done.current || stored || !shouldSaveDraft(draft)) return;
    const timer = setTimeout(() => { void saveDraftOn(getDb(), draft).catch(() => {}); }, 300);
    return () => clearTimeout(timer);
  }, [draft, stored]);

  const leave = useCallback(() => { router.back(); }, [router]);

  const requestExit = useCallback(() => {
    if (!draft || stored) { leave(); return; }
    if (exitAction(draft) === 'leave') { leave(); return; }
    showAlert('¿Salir del registro?', 'Tu avance se guarda. Podrás continuar cuando vuelvas a escanear este código.', [
      { text: 'Seguir aquí', style: 'cancel' },
      { text: 'Salir', onPress: () => { void saveDraftOn(getDb(), draft).catch(() => {}).finally(leave); } },
    ]);
  }, [draft, stored, leave]);

  const goBack = useCallback(() => {
    if (!draft) return;
    if (draft.step === 'welcome') { requestExit(); return; }
    setError(null);
    setDraft(back(draft, Date.now()));
  }, [draft, requestExit]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [goBack]);

  const patch = (changes: Partial<WizardDraft>) => {
    setError(null);
    setDraft((current) => (current ? { ...current, ...changes, updatedAt: Date.now() } : current));
  };

  const capture = async (source: 'camera' | 'gallery') => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const uri = source === 'camera' ? await takePhoto() : await pickFromGallery();
      if (uri) patch({ photoUri: uri });
      else setError('No se pudo abrir la cámara o la galería. Revisa el permiso en los ajustes del teléfono.');
    } catch {
      setError('No se pudo tomar la foto. Inténtalo de nuevo o salta este paso.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const quickSale = () => {
    useWizardHandoff.getState().requestQuickSale(code);
    leave();
  };

  const finish = async () => {
    if (!draft || !store || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await finishWizardOn(getDb(), {
        now: () => Date.now(),
        newId,
        deviceId: DEVICE_ID,
        catalogEnabled: isCatalogEnabled(CATALOG_URL),
        getCatalogOptIn: () => getLocalSetting('catalog_opt_in'),
        enqueueContribution: (contribution) => enqueueContribution(contribution),
        flushQueue: () => { void flushOutbox(); },
      }, store.id, draft);
      if (result.status === 'invalid') {
        setError(result.message);
        setBusy(false);
        return;
      }
      done.current = true;
      cart.add(result.product as Product);
      useWizardHandoff.getState().announce(closingMessage(result));
      leave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el producto. Inténtalo de nuevo.');
      setBusy(false);
    }
  };

  const restart = () => {
    setStored(null);
    void discardDraftOn(getDb(), code).catch(() => {});
  };

  const resume = () => {
    if (stored) setDraft(stored);
    setStored(null);
  };

  if (!draft) {
    return <View style={[s.root, s.center, { backgroundColor: t.bg }]}><ActivityIndicator color={t.accent} /></View>;
  }

  const actions = stepActions(draft);
  const nameCheck = validateName(draft.name);
  const brandCheck = validateBrand(draft.brand);
  const sizeCheck = validateSize(draft.size);
  const priceMessage = stepError('price', draft);

  const primary = (label: string, enabled: boolean, onPress: () => void, loading = false) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.primary, { backgroundColor: t.accent, opacity: enabled && !loading ? 1 : 0.5 }]}
    >
      {loading ? <ActivityIndicator color={t.accentFg} /> : <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }} maxFontSizeMultiplier={1.3}>{label}</Text>}
    </Pressable>
  );

  const goNext = () => {
    setTouched(true);
    const next = advance(draft, Date.now());
    if (next !== draft) { setTouched(false); setDraft(next); }
  };

  const title = (text: string, sub?: string) => (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[s.title, { color: t.fg }]} maxFontSizeMultiplier={1.3} accessibilityRole="header">{text}</Text>
      {sub ? <Text style={{ color: t.muted, fontSize: 15, marginTop: 6, lineHeight: 21 }} maxFontSizeMultiplier={1.3}>{sub}</Text> : null}
    </View>
  );

  const field = (label: string, node: React.ReactNode, message?: string | null) => (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[s.label, { color: t.muted }]} maxFontSizeMultiplier={1.3}>{label}</Text>
      {node}
      {message ? <Text style={{ color: t.dangerText, fontSize: 13, marginTop: 4 }} maxFontSizeMultiplier={1.3}>{message}</Text> : null}
    </View>
  );

  const inputStyle = [s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }];

  const body = (() => {
    if (stored) {
      return (
        <>
          {title('Tienes un registro a medias', 'Encontramos un avance guardado de este producto. ¿Quieres seguir?')}
          <Text style={[s.code, { color: t.fg }]} maxFontSizeMultiplier={1.2} selectable>{code}</Text>
        </>
      );
    }
    switch (draft.step) {
      case 'welcome':
        return (
          <>
            <View style={[s.hero, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="barcode-outline" size={44} color={t.accent} />
            </View>
            {title('Este producto aún no está en tu tienda', 'Regístralo en 1 minuto. Si participas en el catálogo comunitario, también ayudas a otras tiendas.')}
            <Text style={[s.label, { color: t.muted }]} maxFontSizeMultiplier={1.3}>CÓDIGO DE BARRAS</Text>
            <Text style={[s.code, { color: t.fg }]} maxFontSizeMultiplier={1.2} selectable>{code}</Text>
          </>
        );
      case 'photo':
        return (
          <>
            {title('Foto del frente', 'Ayuda a reconocerlo rápido en tu tienda. La foto se queda en tu teléfono.')}
            <View style={[s.photoBox, { borderColor: t.line, backgroundColor: t.panel }]}>
              {draft.photoUri ? (
                <Image source={{ uri: draft.photoUri }} style={s.photo} contentFit="cover" accessibilityLabel="Vista previa de la foto" />
              ) : (
                <Ionicons name="camera-outline" size={56} color={t.muted} />
              )}
            </View>
            <View style={s.row}>
              <Pressable onPress={() => void capture('camera')} disabled={photoBusy} accessibilityRole="button" accessibilityLabel={draft.photoUri ? 'Repetir foto' : 'Tomar foto'} style={[s.secondary, { borderColor: t.accent }]}>
                {photoBusy ? <ActivityIndicator color={t.accent} /> : <Ionicons name="camera" size={20} color={t.accent} />}
                <Text style={{ color: t.accent, fontWeight: '800', marginLeft: 8 }} maxFontSizeMultiplier={1.3}>{draft.photoUri ? 'Repetir' : 'Tomar foto'}</Text>
              </Pressable>
              <Pressable onPress={() => void capture('gallery')} disabled={photoBusy} accessibilityRole="button" accessibilityLabel="Elegir de la galería" style={[s.secondary, { borderColor: t.line }]}>
                <Ionicons name="images-outline" size={20} color={t.fg} />
                <Text style={{ color: t.fg, fontWeight: '700', marginLeft: 8 }} maxFontSizeMultiplier={1.3}>Galería</Text>
              </Pressable>
            </View>
          </>
        );
      case 'details':
        return (
          <>
            {title('¿Cómo se llama?')}
            {field('Nombre del producto', (
              <TextInput
                value={draft.name}
                onChangeText={(value) => patch({ name: value })}
                onBlur={() => setTouched(true)}
                placeholder="Ej. Gaseosa"
                placeholderTextColor={t.muted}
                autoFocus
                autoCapitalize="sentences"
                returnKeyType="next"
                onSubmitEditing={() => brandInput.current?.focus()}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="Nombre del producto"
                style={inputStyle}
              />
            ), touched && !nameCheck.ok ? nameCheck.message : null)}
            {field('Marca (opcional)', (
              <TextInput
                ref={brandInput}
                value={draft.brand}
                onChangeText={(value) => patch({ brand: value })}
                placeholder="Ej. Postobón"
                placeholderTextColor={t.muted}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                onSubmitEditing={() => sizeInput.current?.focus()}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="Marca"
                style={inputStyle}
              />
            ), brandCheck.ok ? null : brandCheck.message)}
            {field('Tamaño (opcional)', (
              <TextInput
                ref={sizeInput}
                value={draft.size}
                onChangeText={(value) => patch({ size: value })}
                placeholder="Ej. 400 ml"
                placeholderTextColor={t.muted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={goNext}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="Tamaño"
                style={inputStyle}
              />
            ), sizeCheck.ok ? null : sizeCheck.message)}
          </>
        );
      case 'category':
        return (
          <>
            {title('¿En qué categoría va?', 'Elige una para encontrarlo más fácil.')}
            {categories.length === 0 ? (
              <Text style={{ color: t.muted, marginBottom: space.md }} maxFontSizeMultiplier={1.3}>Aún no tienes categorías. Puedes crearlas después en Productos.</Text>
            ) : null}
            {categories.map((category) => {
              const on = draft.categoryId === category.id;
              const image = categoryImageFor(category.name);
              const sample = examples[category.id];
              return (
                <Pressable
                  key={category.id}
                  onPress={() => patch({ categoryId: on ? null : category.id })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Categoría ${category.name}`}
                  style={[s.card, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel }]}
                >
                  {image ? <Image source={image} style={s.cardImage} contentFit="cover" /> : (
                    <View style={[s.cardImage, { backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="pricetag-outline" size={22} color={t.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={{ color: t.fg, fontWeight: '800', fontSize: 17 }} maxFontSizeMultiplier={1.3}>{category.name}</Text>
                    {sample && sample.length > 0 ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1} maxFontSizeMultiplier={1.3}>{`Ej.: ${sample.join(', ')}`}</Text> : null}
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={24} color={t.accent} /> : null}
                </Pressable>
              );
            })}
          </>
        );
      case 'price':
        return (
          <>
            {title('¿A cómo lo vendes?')}
            {field('Precio de tu tienda', (
              <View style={[s.priceBox, { borderColor: priceMessage && draft.priceText ? t.danger : t.line, backgroundColor: t.panel }]}>
                <Text style={{ color: t.muted, fontSize: 26, fontWeight: '700', marginRight: 6 }}>$</Text>
                <TextInput
                  value={draft.priceText}
                  onChangeText={(value) => patch({ priceText: formatPriceInput(value) })}
                  placeholder="0"
                  placeholderTextColor={t.muted}
                  keyboardType="number-pad"
                  autoFocus
                  returnKeyType="done"
                  maxFontSizeMultiplier={1.3}
                  accessibilityLabel="Precio de tu tienda"
                  style={{ flex: 1, color: t.fg, fontSize: 30, fontWeight: '800', padding: 0 }}
                />
              </View>
            ), draft.priceText ? priceMessage : null)}
            <MarketPricesCompactView prices={prices} />
            <Text style={{ color: t.muted, fontSize: 13, marginTop: space.md }} maxFontSizeMultiplier={1.3}>
              {`Se creará como: ${composeProductName(brandCheck.ok ? brandCheck.value : '', nameCheck.ok ? nameCheck.value : normalizeName(draft.name), sizeCheck.ok ? sizeCheck.value : '')}`}
            </Text>
          </>
        );
    }
  })();

  const footer = (() => {
    if (stored) {
      return (
        <>
          {primary(RESUME_LABELS.continue, true, resume)}
          <Pressable onPress={restart} accessibilityRole="button" style={s.link}>
            <Text style={{ color: t.muted, fontWeight: '700', fontSize: 15 }}>{RESUME_LABELS.restart}</Text>
          </Pressable>
        </>
      );
    }
    if (actions.isWelcome) {
      return (
        <>
          {primary(WELCOME_LABELS.start, true, () => setDraft(advance(draft, Date.now())))}
          <Pressable onPress={quickSale} accessibilityRole="button" accessibilityLabel={WELCOME_LABELS.quickSale} style={s.link}>
            <Text style={{ color: t.accent, fontWeight: '800', fontSize: 16 }}>{WELCOME_LABELS.quickSale}</Text>
          </Pressable>
        </>
      );
    }
    return (
      <>
        {error ? <Text style={{ color: t.dangerText, fontWeight: '700', marginBottom: space.sm, textAlign: 'center' }}>{error}</Text> : null}
        {actions.primary ? primary(actions.primary.label, actions.primary.enabled, actions.isFinish ? () => void finish() : goNext, actions.isFinish && busy) : null}
        {actions.showSkip ? (
          <Pressable onPress={() => setDraft(skip(draft, Date.now()))} accessibilityRole="button" accessibilityLabel="Saltar este paso" style={s.link}>
            <Text style={{ color: t.accent, fontWeight: '800', fontSize: 16 }}>Saltar</Text>
          </Pressable>
        ) : null}
      </>
    );
  })();

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + space.sm, borderBottomColor: t.line }]}>
        <Pressable onPress={stored ? leave : goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Atrás" style={s.back}>
          <Ionicons name="chevron-back" size={26} color={t.fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 17 }} maxFontSizeMultiplier={1.3}>Registrar producto</Text>
          {!stored ? <Text style={{ color: t.muted, fontSize: 13 }} maxFontSizeMultiplier={1.3}>{progressLabel(draft.step)}</Text> : null}
        </View>
      </View>
      {!stored ? (
        <View style={[s.track, { backgroundColor: t.line }]} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: WIZARD_STEPS.length, now: stepNumber(draft.step) }}>
          <View style={[s.fill, { backgroundColor: t.accent, width: `${(stepNumber(draft.step) / WIZARD_STEPS.length) * 100}%` }]} />
        </View>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
        <View style={[s.footer, { borderTopColor: t.line, backgroundColor: t.bg, paddingBottom: insets.bottom + space.md }]}>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginRight: 4 },
  track: { height: 5 },
  fill: { height: 5, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  content: { padding: space.lg, paddingBottom: space.xxl },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.3 },
  hero: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14, fontSize: 18, minHeight: 56 },
  priceBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 64 },
  photoBox: { height: 240, borderWidth: 1, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: space.lg },
  photo: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', gap: space.md },
  secondary: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: radius.md },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, marginBottom: space.md, minHeight: 72 },
  cardImage: { width: 52, height: 52, borderRadius: radius.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  primary: { minHeight: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
});
