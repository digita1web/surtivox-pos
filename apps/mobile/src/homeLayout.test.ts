import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeMetrics, PROMO_RATIO } from './pos/homeLayout.ts';
import { brandTagline, splitBrandName, DEFAULT_TAGLINE, DEFAULT_STORE_NAME } from './brandName.ts';

const WIDTHS = [320, 360, 393, 411, 480, 600, 720, 840];
const SCALES = [1, 1.15, 1.3, 2];

test('metrics are whole, positive and consistent at every screen width and font scale', () => {
  for (const width of WIDTHS) for (const scale of SCALES) {
    const m = homeMetrics(width, scale);
    for (const [key, value] of Object.entries(m)) {
      if (typeof value === 'number') {
        assert.ok(Number.isInteger(value) && value > 0, `${width}/${scale}: ${key}=${value}`);
      }
    }
    assert.ok(m.cardH > m.photoH, `${width}: la tarjeta debe ser mas alta que su foto`);
    assert.equal(m.promoH, Math.round(m.promoW * PROMO_RATIO), `${width}: la ilustracion conserva su proporcion`);
    if (scale === 1) {
      const limit = width < 360 ? 60 : 40;
      assert.ok(Math.abs(m.promoH - m.cardH) <= limit, `${width}: promo ${m.promoH} y tarjeta ${m.cardH} deben tener alturas parecidas`);
    }
  }
});

test('on phones the first product card and the promo fit side by side without horizontal overflow', () => {
  for (const width of [360, 393, 411, 480, 600]) {
    const m = homeMetrics(width);
    assert.ok(m.cardW + m.gap + m.promoW <= width - 2 * m.pad + 1, `${width}: ${m.cardW}+${m.gap}+${m.promoW} > ${width - 2 * m.pad}`);
  }
});

test('the two action cards stack only on very small screens and the compact header kicks in below 350', () => {
  assert.equal(homeMetrics(320).actionsStacked, true);
  assert.equal(homeMetrics(360).actionsStacked, false);
  assert.equal(homeMetrics(340).compact, true);
  assert.equal(homeMetrics(411).compact, false);
  assert.ok(homeMetrics(320).headerLogo < homeMetrics(411).headerLogo);
});

test('card sizes stay inside sane bounds on tablets and on tiny screens', () => {
  assert.ok(homeMetrics(200).cardW >= 140);
  assert.ok(homeMetrics(1200).cardW <= 210);
  assert.ok(homeMetrics(1200).promoW <= 260);
  assert.ok(homeMetrics(411, 5).cardH <= homeMetrics(411, 1.4).cardH);
});

test('the store name is split into a white lead and a yellow accent, with safe fallbacks', () => {
  assert.deepEqual(splitBrandName('Trailer Rodante'), { lead: 'Trailer', accent: 'Rodante' });
  assert.deepEqual(splitBrandName('  Tienda   Don   José '), { lead: 'Tienda', accent: 'Don José' });
  assert.deepEqual(splitBrandName('Surtimax'), { lead: 'Surtimax', accent: '' });
  assert.deepEqual(splitBrandName('   '), { lead: DEFAULT_STORE_NAME, accent: '' });
  assert.deepEqual(splitBrandName(null), { lead: DEFAULT_STORE_NAME, accent: '' });
});

test('the slogan uses the store tagline when it exists and the brand slogan otherwise', () => {
  assert.equal(brandTagline(null), DEFAULT_TAGLINE);
  assert.equal(brandTagline('   '), DEFAULT_TAGLINE);
  assert.equal(brandTagline(' Lo mejor\ndel barrio '), 'Lo mejor del barrio');
  assert.equal(DEFAULT_TAGLINE, 'Tu tienda, siempre contigo');
});

test('action cards switch to a vertical layout with large system fonts or narrow screens', () => {
  assert.equal(homeMetrics(411, 1).actionVertical, false);
  assert.equal(homeMetrics(411, 1.15).actionVertical, true);
  assert.equal(homeMetrics(411, 1.3).actionVertical, true);
  assert.equal(homeMetrics(340, 1).actionVertical, true);
  assert.equal(homeMetrics(360, 1).actionVertical, false);
});

test('the header always leaves room for the store name next to three buttons', () => {
  for (const width of [320, 340, 360, 393, 411, 480, 600]) {
    const m = homeMetrics(width);
    const nameWidth = width - 2 * m.pad - m.headerLogo - 2 * 12 - m.headerRight;
    assert.ok(nameWidth >= m.brandSize * 3.2, `${width}: ${nameWidth}px para un nombre de ${m.brandSize}px`);
    assert.equal(m.headerRight, 3 * m.headerButton + 16);
  }
});
