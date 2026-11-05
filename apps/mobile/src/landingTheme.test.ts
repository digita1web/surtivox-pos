import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { brand } from './themeColors.ts';

const dir = new URL('../../../landing/', import.meta.url);
const styles = readFileSync(new URL('styles.css', dir), 'utf8');
const legal = readFileSync(new URL('legal.css', dir), 'utf8');
const vars = Object.fromEntries([...styles.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});/g)].map((m) => [m[1]!, m[2]!]));

function channel(hex: string, index: number): number {
  const v = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test('la landing usa la paleta de marca y un fondo claro', () => {
  assert.equal(vars.accent!.toUpperCase(), brand.green);
  assert.equal(vars.ink!.toUpperCase(), brand.background);
  assert.equal(vars.text!.toUpperCase(), brand.text);
  assert.ok(luminance(vars.ink!) > 0.8, 'el fondo de la pagina debe ser claro');
});

test('el texto de la landing cumple 4,5:1 sobre sus superficies', () => {
  const surfaces = ['ink', 'panel', 'paper', 'panel-2'];
  for (const token of ['text', 'muted', 'faint', 'accent', 'accent-bright', 'accent-deep', 'warm-text', 'paper-ink']) {
    for (const surface of surfaces) {
      const ratio = contrast(vars[token]!, vars[surface]!);
      assert.ok(ratio >= 4.5, `--${token} sobre --${surface} = ${ratio.toFixed(2)}`);
    }
  }
  assert.ok(contrast(vars.ink!, vars.accent!) >= 4.5, 'el texto del boton principal sobre el verde');
});

test('no queda texto blanco sobre las tarjetas claras de las paginas legales', () => {
  assert.doesNotMatch(legal, /color:\s*var\(--paper\)/);
});

test('todas las paginas declaran el theme-color verde de marca', () => {
  const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length >= 4);
  for (const page of pages) {
    const html = readFileSync(new URL(page, dir), 'utf8');
    assert.match(html, new RegExp(`<meta name="theme-color" content="${brand.green}">`, 'i'), page);
  }
});
