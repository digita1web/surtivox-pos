import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WIZARD_STEPS, advance, back, buildCatalogContribution, buildProductInput, canAdvance, canFinish, canSkip, composeProductName,
  hasProgress, isDraftStale, isRequiredStep, newDraft, normalizeName, normalizeSize, parseDraft, progressLabel, serializeDraft,
  skip, stepError, validateName, validatePriceText, DRAFT_MAX_AGE_MS, type WizardDraft,
} from './productWizard.ts';

const NOW = 1_800_000_000_000;
const EAN = '7701234567897';

const filled = (over: Partial<WizardDraft> = {}): WizardDraft => ({
  ...newDraft(EAN, NOW), step: 'welcome', name: 'Gaseosa', brand: 'Postobón', size: '400 ml', priceText: '2.500', ...over,
});

test('el recorrido tiene 5 pasos en orden y la etiqueta de progreso', () => {
  assert.deepEqual([...WIZARD_STEPS], ['welcome', 'photo', 'details', 'category', 'price']);
  assert.equal(progressLabel('welcome'), 'Paso 1 de 5');
  assert.equal(progressLabel('price'), 'Paso 5 de 5');
});

test('solo la foto y la categoria se pueden saltar; nombre y precio son obligatorios', () => {
  assert.deepEqual(WIZARD_STEPS.filter(canSkip), ['photo', 'category']);
  assert.deepEqual(WIZARD_STEPS.filter(isRequiredStep), ['details', 'price']);
});

test('avanzar paso a paso y bloquear el paso de detalles sin nombre', () => {
  let draft = newDraft(EAN, NOW);
  draft = advance(draft, NOW + 1);
  assert.equal(draft.step, 'photo');
  draft = advance(draft, NOW + 2);
  assert.equal(draft.step, 'details');
  assert.equal(canAdvance(draft), false);
  assert.equal(advance(draft, NOW + 3).step, 'details');
  draft = advance({ ...draft, name: 'Arroz' }, NOW + 4);
  assert.equal(draft.step, 'category');
  draft = advance(draft, NOW + 5);
  assert.equal(draft.step, 'price');
  assert.equal(canAdvance(draft), false);
});

test('saltar la foto y la categoria, pero no los pasos obligatorios', () => {
  const atPhoto = skip({ ...newDraft(EAN, NOW), step: 'photo', photoUri: 'file:///x.webp' }, NOW);
  assert.equal(atPhoto.step, 'details');
  assert.equal(atPhoto.photoUri, null);
  const atCategory = skip({ ...filled(), step: 'category', categoryId: 'c1' }, NOW);
  assert.equal(atCategory.step, 'price');
  assert.equal(atCategory.categoryId, null);
  for (const step of ['welcome', 'details', 'price'] as const) {
    const draft = { ...filled(), step };
    assert.equal(skip(draft, NOW + 9), draft);
  }
});

test('retroceder conserva todo lo escrito y no pasa de la bienvenida', () => {
  const draft = filled({ step: 'price', photoUri: 'file:///x.webp', categoryId: 'c1' });
  const prev = back(back(back(draft, NOW + 1), NOW + 2), NOW + 3);
  assert.equal(prev.step, 'photo');
  assert.equal(prev.name, 'Gaseosa');
  assert.equal(prev.priceText, '2.500');
  assert.equal(prev.photoUri, 'file:///x.webp');
  assert.equal(prev.categoryId, 'c1');
  const first = back(newDraft(EAN, NOW), NOW + 1);
  assert.equal(first.step, 'welcome');
});

test('puede finalizar solo con nombre y precio validos', () => {
  assert.equal(canFinish(filled()), true);
  assert.equal(canFinish(filled({ name: '' })), false);
  assert.equal(canFinish(filled({ priceText: '' })), false);
  assert.equal(canFinish(filled({ priceText: '0' })), false);
  assert.equal(canFinish(filled({ barcode: '' })), false);
});

test('validacion del nombre: vacio, un caracter, limites y sin letras', () => {
  assert.equal(validateName('').ok, false);
  assert.equal(validateName('   ').ok, false);
  assert.equal(validateName('A').ok, false);
  assert.equal(validateName('Ab').ok, true);
  assert.equal(validateName('x'.repeat(60)).ok, true);
  assert.equal(validateName('x'.repeat(61)).ok, false);
  assert.equal(validateName('1234').ok, false);
  assert.equal(validateName('Aceite\u0007 oliva').ok, false);
  const empty = validateName('');
  assert.ok(!empty.ok && empty.message === 'Escribe el nombre del producto.');
});

test('validacion del precio: cero, negativo, con puntos y comas, y texto', () => {
  const ok = (text: string) => { const r = validatePriceText(text); return r.ok ? r.value : null; };
  assert.equal(ok('1.990'), 1990);
  assert.equal(ok('1,990'), 1990);
  assert.equal(ok('2500'), 2500);
  assert.equal(ok('12.500.000'), 12_500_000);
  assert.equal(ok(' 500 '), 500);
  for (const bad of ['', '0', '000', '-5', '-1.990', '1.5', '1990.50', '1.99', 'abc', '12a', '1..990', '1.9900', '$ 2.500']) {
    assert.equal(validatePriceText(bad).ok, false, bad);
  }
  assert.equal(validatePriceText('100.000.001').ok, false);
  assert.equal(validatePriceText('100.000.000').ok, true);
});

test('normaliza espacios y capitaliza sin romper marcas en mayuscula ni unidades', () => {
  assert.equal(normalizeName('  gaseosa   postobon  400ml '), 'Gaseosa Postobon 400ml');
  assert.equal(normalizeName('COCA-COLA zero'), 'COCA-COLA Zero');
  assert.equal(normalizeName('arroz de la casa'), 'Arroz de la Casa');
  assert.equal(normalizeName('leche entera 1 l'), 'Leche Entera 1 l');
  assert.equal(normalizeName('coca-cola sin azúcar'), 'Coca-Cola sin Azúcar');
  assert.equal(normalizeName('iPhone cargador'), 'iPhone Cargador');
  assert.equal(normalizeSize('  400   ml '), '400 ml');
});

test('el tamano tiene limite de 20 caracteres', () => {
  const draft = filled({ size: 'x'.repeat(21) });
  assert.match(stepError('details', draft) ?? '', /tamaño es muy largo/);
  assert.equal(buildProductInput(draft).ok, false);
  assert.equal(buildCatalogContribution(draft), null);
});

test('compone el nombre del producto sin repetir marca ni tamano', () => {
  assert.equal(composeProductName('Postobón', 'Gaseosa', '400 ml'), 'Postobón Gaseosa 400 ml');
  assert.equal(composeProductName('Postobón', 'Gaseosa Postobón', ''), 'Gaseosa Postobón');
  assert.equal(composeProductName('', 'Arroz', '500 g'), 'Arroz 500 g');
  assert.equal(composeProductName('', 'Arroz 500 g', '500 g'), 'Arroz 500 g');
});

test('la entrada del producto lleva precio entero, categoria y foto local', () => {
  const result = buildProductInput(filled({ categoryId: 'c1', photoUri: 'file:///x.webp', priceText: '1.990' }));
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.value, {
      barcode: EAN, name: 'Postobón Gaseosa 400 ml', sellingPrice: 1990, categoryId: 'c1', photoUri: 'file:///x.webp',
    });
  }
  assert.equal(buildProductInput(filled({ name: '' })).ok, false);
});

test('la contribucion al catalogo solo lleva codigo, nombre y presentacion', () => {
  const contribution = buildCatalogContribution(filled({ categoryId: 'c1', photoUri: 'file:///x.webp' }));
  assert.deepEqual(contribution, { code: EAN, name: 'Postobón Gaseosa', presentation: '400 ml' });
  assert.deepEqual(Object.keys(contribution!).sort(), ['code', 'name', 'presentation']);
  assert.equal(buildCatalogContribution(filled({ size: '' }))?.presentation, null);
});

test('no hay contribucion si el codigo no es un EAN, el nombre es corto o generico', () => {
  assert.equal(buildCatalogContribution(filled({ barcode: 'INT-001' })), null);
  assert.equal(buildCatalogContribution(filled({ name: 'Ab', brand: '' })), null);
  assert.equal(buildCatalogContribution(filled({ name: 'Producto 1234', brand: '' })), null);
  assert.equal(buildCatalogContribution(filled({ name: 'Visita www.tienda.com', brand: '' })), null);
  assert.equal(buildCatalogContribution(filled({ name: 'Gaseosa', brand: 'x'.repeat(40) })), null);
});

test('el borrador se guarda y se lee con su version', () => {
  const draft = filled({ step: 'category', photoUri: 'file:///x.webp', categoryId: 'c1' });
  assert.deepEqual(parseDraft(serializeDraft(draft)), draft);
});

test('un borrador con version desconocida o roto se descarta sin romper', () => {
  const draft = filled();
  assert.equal(parseDraft(JSON.stringify({ ...draft, v: 2 })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, v: undefined })), null);
  assert.equal(parseDraft('no es json'), null);
  assert.equal(parseDraft('[]'), null);
  assert.equal(parseDraft('null'), null);
  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, step: 'otro' })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, name: 5 })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, barcode: '' })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, createdAt: 'ayer' })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, name: 'x'.repeat(500) })), null);
});

test('un borrador pasa a viejo despues de 7 dias', () => {
  const draft = filled();
  assert.equal(isDraftStale(draft, NOW + DRAFT_MAX_AGE_MS), false);
  assert.equal(isDraftStale(draft, NOW + DRAFT_MAX_AGE_MS + 1), true);
});

test('hasProgress distingue un borrador vacio de uno con cambios', () => {
  assert.equal(hasProgress(newDraft(EAN, NOW)), false);
  assert.equal(hasProgress({ ...newDraft(EAN, NOW), step: 'photo' }), true);
  assert.equal(hasProgress({ ...newDraft(EAN, NOW), name: 'Arroz' }), true);
});
