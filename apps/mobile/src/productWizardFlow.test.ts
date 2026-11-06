import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIZARD_STEPS, advance, newDraft, type WizardDraft } from './productWizard.ts';
import { WELCOME_LABELS, exitAction, resumeOffer, shouldSaveDraft, stepActions } from './productWizardFlow.ts';

const NOW = 1_800_000_000_000;
const EAN = '7701234567897';
const at = (step: WizardDraft['step'], over: Partial<WizardDraft> = {}): WizardDraft => ({ ...newDraft(EAN, NOW), step, ...over });

test('la bienvenida no tiene atras, siguiente ni saltar: solo sus dos acciones', () => {
  const actions = stepActions(at('welcome'));
  assert.deepEqual(actions, { showBack: false, primary: null, showSkip: false, isWelcome: true, isFinish: false });
  assert.equal(WELCOME_LABELS.start, 'Empezar');
  assert.equal(WELCOME_LABELS.quickSale, 'Vender ahora sin registrar');
});

test('foto: saltar mientras no hay foto y Siguiente cuando ya hay', () => {
  assert.deepEqual(stepActions(at('photo')), { showBack: true, primary: null, showSkip: true, isWelcome: false, isFinish: false });
  const withPhoto = stepActions(at('photo', { photoUri: 'file:///a.webp' }));
  assert.deepEqual(withPhoto.primary, { label: 'Siguiente', enabled: true });
  assert.equal(withPhoto.showSkip, false);
});

test('detalles: Siguiente solo se habilita con un nombre valido y nunca se puede saltar', () => {
  assert.equal(stepActions(at('details')).primary?.enabled, false);
  assert.equal(stepActions(at('details', { name: 'A' })).primary?.enabled, false);
  assert.equal(stepActions(at('details', { name: 'Arroz' })).primary?.enabled, true);
  assert.equal(stepActions(at('details', { name: 'Arroz' })).showSkip, false);
});

test('categoria: saltar si no se eligio y Siguiente si se eligio', () => {
  assert.equal(stepActions(at('category')).showSkip, true);
  assert.equal(stepActions(at('category')).primary, null);
  const chosen = stepActions(at('category', { categoryId: 'c1' }));
  assert.equal(chosen.showSkip, false);
  assert.deepEqual(chosen.primary, { label: 'Siguiente', enabled: true });
});

test('precio: Crear producto solo con nombre y precio validos y sin saltar', () => {
  assert.deepEqual(stepActions(at('price', { name: 'Arroz' })).primary, { label: 'Crear producto', enabled: false });
  assert.equal(stepActions(at('price', { name: 'Arroz', priceText: '0' })).primary?.enabled, false);
  const ready = stepActions(at('price', { name: 'Arroz', priceText: '2.500' }));
  assert.deepEqual(ready.primary, { label: 'Crear producto', enabled: true });
  assert.equal(ready.isFinish, true);
  assert.equal(ready.showSkip, false);
});

test('atras esta disponible en todos los pasos menos la bienvenida', () => {
  assert.deepEqual(WIZARD_STEPS.filter((step) => stepActions(at(step)).showBack), ['photo', 'details', 'category', 'price']);
});

test('navegacion completa solo con lo minimo: nombre y precio', () => {
  let draft = newDraft(EAN, NOW);
  draft = advance(draft, NOW);
  draft = advance(draft, NOW);
  draft = advance({ ...draft, name: 'Arroz' }, NOW);
  draft = advance(draft, NOW);
  assert.equal(draft.step, 'price');
  assert.equal(stepActions({ ...draft, priceText: '2.500' }).primary?.enabled, true);
});

test('salir sin avance no pide confirmacion y con avance si', () => {
  assert.equal(exitAction(newDraft(EAN, NOW)), 'leave');
  assert.equal(exitAction(at('photo')), 'confirm');
  assert.equal(exitAction(at('welcome', { name: 'Arroz' })), 'confirm');
});

test('la reanudacion solo se ofrece si hay un borrador con avance', () => {
  assert.equal(resumeOffer(null), 'none');
  assert.equal(resumeOffer(newDraft(EAN, NOW)), 'none');
  assert.equal(resumeOffer(at('category', { name: 'Arroz' })), 'offer');
});

test('Vender ahora sin registrar en la bienvenida no deja borrador que guardar', () => {
  const fresh = newDraft(EAN, NOW);
  assert.equal(shouldSaveDraft(fresh), false);
  assert.equal(shouldSaveDraft(advance(fresh, NOW)), true);
});
