import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brand, light, dark, TILE_COLORS } from './themeColors.ts';
import { DEFAULT_ACCENT, ACCENT_PRESETS } from './branding.ts';

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
  test(`tema ${name}: muted, faint, dangerText y warnText cumplen 4,5:1 sobre todas las superficies`, () => {
    for (const token of ['muted', 'faint', 'dangerText', 'warnText'] as const) {
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

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

test('danger y warn no se usan como color de texto: para eso existen dangerText y warnText', () => {
  const root = new URL('..', import.meta.url).pathname;
  const offenders: string[] = [];
  for (const file of [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'src'))]) {
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (/(^|[^A-Za-z])color:\s*[^,}]*\bt\.(danger|warn)\b(?!Text)/.test(line)) offenders.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('los colores de texto de peligro y aviso siguen siendo rojo y ambar', () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  for (const theme of [light, dark]) {
    assert.ok(Math.abs(hue(theme.dangerText) - hue(theme.danger)) < 15);
    assert.ok(Math.abs(hue(theme.warnText) - hue(theme.warn)) < 15);
  }
});

test('la paleta de marca conserva los colores acordados', () => {
  assert.deepEqual({ ...brand }, {
    green: '#087F5B', greenBright: '#00B96B', greenDark: '#064E3B', greenSoft: '#D9FBE8',
    mango: '#F4B942', sun: '#FFD43B', orange: '#FF8A00', coral: '#F16B5B',
    background: '#F4F7F5', surface: '#FFFFFF', text: '#102A24', border: '#E5ECE8', iconInactive: '#687783',
  });
  assert.equal(light.accent, brand.green);
  assert.equal(light.accentSoft, brand.greenSoft);
  assert.equal(light.bg, brand.background);
  assert.equal(light.panel, brand.surface);
  assert.equal(light.fg, brand.text);
  assert.equal(light.line, brand.border);
  assert.equal(light.tabInactive, brand.iconInactive);
});

test('ningun fondo principal es negro en ningun tema', () => {
  for (const theme of [light, dark]) {
    for (const surface of ['bg', 'panel', 'surfaceAlt'] as const) assert.notEqual(theme[surface].toLowerCase(), '#000000');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(theme.bg.slice(i, i + 2), 16)) as [number, number, number];
    assert.ok(g > r && g >= b, `el fondo ${theme.bg} debe ser verdoso, no negro ni gris`);
  }
});

for (const [name, theme] of [['claro', light], ['oscuro', dark]] as const) {
  test(`tema ${name}: el verde de marca cumple 4,5:1 como texto y con texto de contraste encima`, () => {
    for (const surface of ['bg', 'panel', 'surfaceAlt', 'chip', 'accentSoft'] as const) {
      const ratio = contrast(theme.accent, theme[surface]);
      assert.ok(ratio >= AA, `${name}: accent sobre ${surface} = ${ratio.toFixed(2)}`);
    }
    assert.ok(contrast(theme.accentFg, theme.accent) >= AA, `${name}: accentFg sobre accent`);
  });

  test(`tema ${name}: los iconos inactivos de la barra llegan a 3:1`, () => {
    assert.ok(contrast(theme.tabInactive, theme.panel) >= 3, `${name}: tabInactive sobre panel`);
  });
}

test('el color por defecto de los recibos es el verde de marca', () => {
  assert.equal(DEFAULT_ACCENT, brand.green.toLowerCase());
  assert.equal(ACCENT_PRESETS[0], brand.green.toLowerCase());
});

test('las baldosas de producto sin foto dejan leer las iniciales blancas a 4,5:1', () => {
  for (const color of TILE_COLORS) assert.ok(contrast('#FFFFFF', color) >= AA, `${color} = ${contrast('#FFFFFF', color).toFixed(2)}`);
  assert.equal(TILE_COLORS[0], brand.green);
});
