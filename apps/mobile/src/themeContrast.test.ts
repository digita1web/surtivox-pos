import { test } from 'node:test';
import assert from 'node:assert/strict';
import { light, dark } from './themeColors.ts';

function channel(hex: string, index: number): number {
  const v = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = ['bg', 'panel', 'surfaceAlt', 'chip', 'accentSoft', 'line'] as const;
const AA = 4.5;

for (const [name, theme] of [['claro', light], ['oscuro', dark]] as const) {
  test(`tema ${name}: muted y faint cumplen 4,5:1 sobre todas las superficies`, () => {
    for (const token of ['muted', 'faint'] as const) {
      for (const surface of SURFACES) {
        const ratio = contrast(theme[token], theme[surface]);
        assert.ok(ratio >= AA, `${name}: ${token} sobre ${surface} = ${ratio.toFixed(2)}`);
      }
    }
  });

  test(`tema ${name}: el texto principal supera 7:1`, () => {
    for (const surface of SURFACES) assert.ok(contrast(theme.fg, theme[surface]) >= 7, `${name}: fg sobre ${surface}`);
  });
}

test('el calculo de contraste coincide con valores conocidos', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#ffffff', '#ffffff').toFixed(1), '1.0');
  assert.ok(contrast('#707a89', '#f2f4f7') < AA);
  assert.ok(contrast('#9aa4b2', '#ffffff') < AA);
});

test('muted se mantiene mas contrastado que faint en ambos temas', () => {
  assert.ok(contrast(light.muted, light.bg) >= contrast(light.faint, light.bg));
  assert.ok(contrast(dark.muted, dark.bg) >= contrast(dark.faint, dark.bg));
});
