import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const bytes = (path: string) => readFileSync(new URL(path, root));

function webpSize(file: Buffer): { width: number; height: number } {
  assert.equal(file.toString('ascii', 0, 4), 'RIFF');
  assert.equal(file.toString('ascii', 8, 12), 'WEBP');
  const kind = file.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { width: file.readUInt16LE(26) & 0x3fff, height: file.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = file.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: 1 + file.readUIntLE(24, 3), height: 1 + file.readUIntLE(27, 3) };
}

function pngSize(file: Buffer): { width: number; height: number } {
  assert.equal(file.toString('ascii', 1, 4), 'PNG');
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

const html = read('landing/index.html');
const css = read('landing/styles.css');
const screens = [...html.matchAll(/<img src="(assets\/screen-[a-z]+\.webp)" width="(\d+)" height="(\d+)"/g)];

test('la landing declara el tamaño real de cada pantalla de la app', () => {
  assert.ok(screens.length >= 4);
  for (const [, path, width, height] of screens) {
    const real = webpSize(bytes(`landing/${path}`));
    assert.deepEqual({ width: Number(width), height: Number(height) }, real, path);
  }
});

test('el marco del teléfono tiene la misma proporción que las capturas para no recortarlas ni dejar huecos', () => {
  const frame = css.match(/\.phone-screen \{[^}]*aspect-ratio: (\d+) \/ (\d+);/);
  assert.ok(frame);
  const frameRatio = Number(frame![1]) / Number(frame![2]);
  const names = new Set(screens.map((match) => match[1]!));
  for (const path of names) {
    const real = webpSize(bytes(`landing/${path}`));
    assert.ok(Math.abs(real.width / real.height - frameRatio) < 0.001, path);
  }
});

test('la imagen para compartir mide lo que dicen las etiquetas Open Graph', () => {
  const declared = {
    width: Number(html.match(/og:image:width" content="(\d+)"/)![1]),
    height: Number(html.match(/og:image:height" content="(\d+)"/)![1]),
  };
  assert.deepEqual(pngSize(bytes('landing/assets/og-image.png')), declared);
});

test('las capturas del README existen, son PNG verticales de 720 px de ancho y todas se muestran', () => {
  const readme = read('README.md');
  const used = [...readme.matchAll(/docs\/screenshots\/([\w-]+\.png)/g)].map((match) => match[1]!);
  assert.equal(new Set(used).size, 4);
  for (const name of new Set(used)) {
    const size = pngSize(bytes(`docs/screenshots/${name}`));
    assert.equal(size.width, 720, name);
    assert.ok(size.height > 1000, name);
  }
});
