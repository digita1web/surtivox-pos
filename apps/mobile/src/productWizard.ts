import { APP_CURRENCY, parseCurrencyInput } from './branding.ts';
import { isCatalogEan, isCatalogName, isGenericCatalogName } from './catalogCore.ts';

export const DRAFT_VERSION = 1;
export const DRAFT_KEY_PREFIX = 'product_wizard_draft:';
export const DRAFT_MAX_AGE_MS = 7 * 24 * 3_600_000;

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const BRAND_MAX = 30;
export const SIZE_MAX = 20;
export const BARCODE_MAX = 64;
export const PRICE_MAX = 100_000_000;
const FIELD_STORAGE_MAX = 200;

export const WIZARD_STEPS = ['welcome', 'photo', 'details', 'category', 'price'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface WizardDraft {
  v: typeof DRAFT_VERSION;
  barcode: string;
  step: WizardStep;
  photoUri: string | null;
  name: string;
  brand: string;
  size: string;
  categoryId: string | null;
  priceText: string;
  createdAt: number;
  updatedAt: number;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string };

export function newDraft(barcode: string, now: number): WizardDraft {
  return {
    v: DRAFT_VERSION,
    barcode: barcode.trim(),
    step: 'welcome',
    photoUri: null,
    name: '',
    brand: '',
    size: '',
    categoryId: null,
    priceText: '',
    createdAt: now,
    updatedAt: now,
  };
}

export const draftKey = (barcode: string) => `${DRAFT_KEY_PREFIX}${barcode.trim()}`;

export function stepNumber(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step) + 1;
}

export function progressLabel(step: WizardStep): string {
  return `Paso ${stepNumber(step)} de ${WIZARD_STEPS.length}`;
}

export function canSkip(step: WizardStep): boolean {
  return step === 'photo' || step === 'category';
}

export function isRequiredStep(step: WizardStep): boolean {
  return step === 'details' || step === 'price';
}

export function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const CONNECTORS = new Set(['de', 'del', 'la', 'el', 'y', 'con', 'sin', 'para', 'por', 'en', 'a', 'al', 'los', 'las', 'o', 'u']);
const UNITS = new Set(['ml', 'l', 'g', 'kg', 'gr', 'lb', 'oz', 'cc', 'mg', 'und', 'x']);

function capitalizeToken(token: string, isFirst: boolean): string {
  if (/\d/.test(token)) return token;
  const lower = token.toLowerCase();
  const upper = token.toUpperCase();
  if (token === upper && token !== lower) return token;
  if (token !== lower) return token;
  if (UNITS.has(lower)) return token;
  if (!isFirst && CONNECTORS.has(lower)) return token;
  return token.replace(/(^|[-/'’])(\p{L})/gu, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);
}

export function normalizeTitle(text: string): string {
  return normalizeSpaces(text)
    .split(' ')
    .map((token, index) => capitalizeToken(token, index === 0))
    .join(' ');
}

export const normalizeName = normalizeTitle;
export const normalizeBrand = normalizeTitle;

export function normalizeSize(text: string): string {
  return normalizeSpaces(text);
}

const hasControlChars = (text: string) => /[\u0000-\u001f\u007f]/.test(text);

export function validateName(raw: string): Validation<string> {
  const value = normalizeName(raw);
  if (value.length === 0) return { ok: false, message: 'Escribe el nombre del producto.' };
  if (value.length < NAME_MIN) return { ok: false, message: `El nombre debe tener al menos ${NAME_MIN} letras.` };
  if (value.length > NAME_MAX) return { ok: false, message: `El nombre es muy largo (máximo ${NAME_MAX} caracteres).` };
  if (!/\p{L}/u.test(value)) return { ok: false, message: 'El nombre debe incluir letras.' };
  if (hasControlChars(value)) return { ok: false, message: 'El nombre tiene caracteres que no se pueden usar.' };
  return { ok: true, value };
}

export function validateBrand(raw: string): Validation<string> {
  const value = normalizeBrand(raw);
  if (value.length > BRAND_MAX) return { ok: false, message: `La marca es muy larga (máximo ${BRAND_MAX} caracteres).` };
  if (hasControlChars(value)) return { ok: false, message: 'La marca tiene caracteres que no se pueden usar.' };
  return { ok: true, value };
}

export function validateSize(raw: string): Validation<string> {
  const value = normalizeSize(raw);
  if (value.length > SIZE_MAX) return { ok: false, message: `El tamaño es muy largo (máximo ${SIZE_MAX} caracteres).` };
  if (hasControlChars(value)) return { ok: false, message: 'El tamaño tiene caracteres que no se pueden usar.' };
  return { ok: true, value };
}

export function validateBarcode(raw: string): Validation<string> {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, message: 'Falta el código de barras.' };
  if (value.length > BARCODE_MAX || /\s/.test(value) || hasControlChars(value)) {
    return { ok: false, message: 'El código de barras no es válido.' };
  }
  return { ok: true, value };
}

export function formatPriceInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const GROUPED = /^\d{1,3}([.,]\d{3})+$/;

export function validatePriceText(raw: string): Validation<number> {
  const text = raw.trim();
  if (text.length === 0) return { ok: false, message: 'Escribe el precio.' };
  if (/^-/.test(text)) return { ok: false, message: 'El precio no puede ser negativo.' };
  if (!/^\d+$/.test(text) && !GROUPED.test(text)) {
    return { ok: false, message: 'Escribe el precio en pesos, sin centavos. Por ejemplo: 2.500' };
  }
  const digits = text.replace(/[.,]/g, '');
  let value: number;
  try {
    value = parseCurrencyInput(digits, APP_CURRENCY.code);
  } catch {
    return { ok: false, message: 'Escribe el precio en pesos, sin centavos. Por ejemplo: 2.500' };
  }
  if (!Number.isInteger(value) || value <= 0) return { ok: false, message: 'El precio debe ser mayor que cero.' };
  if (value > PRICE_MAX) return { ok: false, message: 'Ese precio es demasiado alto. Revísalo.' };
  return { ok: true, value };
}

export function stepError(step: WizardStep, draft: WizardDraft): string | null {
  if (step === 'details') {
    const name = validateName(draft.name);
    if (!name.ok) return name.message;
    const brand = validateBrand(draft.brand);
    if (!brand.ok) return brand.message;
    const size = validateSize(draft.size);
    return size.ok ? null : size.message;
  }
  if (step === 'price') {
    const price = validatePriceText(draft.priceText);
    return price.ok ? null : price.message;
  }
  return null;
}

export function canAdvance(draft: WizardDraft): boolean {
  return draft.step !== 'price' && stepError(draft.step, draft) === null;
}

function neighbor(step: WizardStep, delta: number): WizardStep {
  const index = WIZARD_STEPS.indexOf(step) + delta;
  return WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, Math.max(0, index))]!;
}

export function advance(draft: WizardDraft, now: number): WizardDraft {
  if (!canAdvance(draft)) return draft;
  return { ...draft, step: neighbor(draft.step, 1), updatedAt: now };
}

export function skip(draft: WizardDraft, now: number): WizardDraft {
  if (!canSkip(draft.step)) return draft;
  const cleared = draft.step === 'photo' ? { photoUri: null } : { categoryId: null };
  return { ...draft, ...cleared, step: neighbor(draft.step, 1), updatedAt: now };
}

export function back(draft: WizardDraft, now: number): WizardDraft {
  if (draft.step === 'welcome') return draft;
  return { ...draft, step: neighbor(draft.step, -1), updatedAt: now };
}

export function canFinish(draft: WizardDraft): boolean {
  return validateBarcode(draft.barcode).ok && stepError('details', draft) === null && stepError('price', draft) === null;
}

export function hasProgress(draft: WizardDraft): boolean {
  return draft.step !== 'welcome'
    || draft.photoUri !== null
    || draft.name.trim() !== ''
    || draft.brand.trim() !== ''
    || draft.size.trim() !== ''
    || draft.categoryId !== null
    || draft.priceText.trim() !== '';
}

function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(haystack);
}

export function composeProductName(brand: string, name: string, size: string): string {
  const parts: string[] = [];
  if (brand && !containsWord(name, brand)) parts.push(brand);
  parts.push(name);
  if (size && !containsWord(name, size)) parts.push(size);
  return normalizeSpaces(parts.join(' '));
}

export interface WizardProductInput {
  barcode: string;
  name: string;
  sellingPrice: number;
  categoryId: string | null;
  photoUri: string | null;
}

export function buildProductInput(draft: WizardDraft): Validation<WizardProductInput> {
  const barcode = validateBarcode(draft.barcode);
  if (!barcode.ok) return barcode;
  const name = validateName(draft.name);
  if (!name.ok) return name;
  const brand = validateBrand(draft.brand);
  if (!brand.ok) return brand;
  const size = validateSize(draft.size);
  if (!size.ok) return size;
  const price = validatePriceText(draft.priceText);
  if (!price.ok) return price;
  return {
    ok: true,
    value: {
      barcode: barcode.value,
      name: composeProductName(brand.value, name.value, size.value),
      sellingPrice: price.value,
      categoryId: draft.categoryId,
      photoUri: draft.photoUri,
    },
  };
}

export interface CatalogContribution {
  code: string;
  name: string;
  presentation: string | null;
}

export function buildCatalogContribution(draft: WizardDraft): CatalogContribution | null {
  const barcode = validateBarcode(draft.barcode);
  const name = validateName(draft.name);
  const brand = validateBrand(draft.brand);
  const size = validateSize(draft.size);
  if (!barcode.ok || !name.ok || !brand.ok || !size.ok) return null;
  if (!isCatalogEan(barcode.value)) return null;
  const catalogName = composeProductName(brand.value, name.value, '');
  const presentation = size.value.length > 0 ? size.value : null;
  if (!isCatalogName(catalogName) || isGenericCatalogName(catalogName)) return null;
  return { code: barcode.value, name: catalogName, presentation };
}

export function serializeDraft(draft: WizardDraft): string {
  return JSON.stringify(draft);
}

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function parseDraft(raw: string | null): WizardDraft | null {
  if (!raw) return null;
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (data.v !== DRAFT_VERSION) return null;
  if (!isText(data.barcode, BARCODE_MAX) || !validateBarcode(data.barcode).ok) return null;
  if (typeof data.step !== 'string' || !(WIZARD_STEPS as readonly string[]).includes(data.step)) return null;
  if (!isText(data.name, FIELD_STORAGE_MAX) || !isText(data.brand, FIELD_STORAGE_MAX) || !isText(data.size, FIELD_STORAGE_MAX)) return null;
  if (!isText(data.priceText, FIELD_STORAGE_MAX)) return null;
  if (data.photoUri !== null && !isText(data.photoUri, 1000)) return null;
  if (data.categoryId !== null && !isText(data.categoryId, FIELD_STORAGE_MAX)) return null;
  if (!isTime(data.createdAt) || !isTime(data.updatedAt)) return null;
  return {
    v: DRAFT_VERSION,
    barcode: data.barcode,
    step: data.step as WizardStep,
    photoUri: data.photoUri as string | null,
    name: data.name,
    brand: data.brand,
    size: data.size,
    categoryId: data.categoryId as string | null,
    priceText: data.priceText,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function isDraftStale(draft: WizardDraft, now: number): boolean {
  return now - draft.updatedAt > DRAFT_MAX_AGE_MS;
}
