import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUSINESS_TYPES } from './catalogPack.ts';

const landing = new URL('../../../landing/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, landing), 'utf8');
const help = read('ayuda.html');
const more = readFileSync(new URL('../app/(tabs)/more.tsx', import.meta.url), 'utf8');
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as { expo: { version: string } };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('el centro de ayuda dice la versión publicada de la app', () => {
  assert.match(help, new RegExp(`<span data-help-version>${app.expo.version.replace(/\./g, '\\.')}</span>`));
});

test('cada artículo tiene un id único, un título h3 y los enlaces internos llevan a algo que existe', () => {
  const ids = [...help.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(new Set(ids).size, ids.length);
  const articles = [...help.matchAll(/<details class="help-article" id="([^"]+)">\s*<summary><h3>[^<]+<\/h3><\/summary>/g)];
  assert.ok(articles.length >= 45, `${articles.length} artículos`);
  assert.equal(articles.length, (help.match(/class="help-article"/g) ?? []).length);
  for (const anchor of help.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(anchor[1]!), `#${anchor[1]}`);
  const home = read('index.html');
  const homeIds = [...home.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  for (const anchor of help.matchAll(/href="index\.html#([^"]+)"/g)) assert.ok(homeIds.includes(anchor[1]!), `index.html#${anchor[1]}`);
});

test('cada ruta "Más → …" que nombra la ayuda existe en el menú Más de la app', () => {
  const paths = [...text(help).matchAll(/Más → ([A-ZÁÉÍÓÚÑ][^→.,:(]*?)(?=\s*(?:→|\.|,|:|\(| se | eliges | cambias | toca | la app | están | guardas | comparte ))/g)].map((m) => m[1]!.trim());
  assert.ok(paths.length >= 12, paths.join(' | '));
  for (const p of new Set(paths)) {
    const label = p === 'Apariencia' ? 'APARIENCIA' : p;
    assert.ok(more.includes(label) || more.toUpperCase().includes(label.toUpperCase()), `Más → ${p} no existe en more.tsx`);
  }
});

test('la ayuda no anuncia funciones que la versión publicada no tiene', () => {
  const visible = text(help.replace(/<code>[^<]*<\/code>/g, ''));
  for (const phrase of [/sincroniza(ción)? automática/i, /Google Play\b(?! y no)/, /factura electrónica(?! de la DIAN)/i, /\bstock\b/i]) {
    assert.doesNotMatch(visible, phrase);
  }
  assert.match(visible, /no es una factura electrónica de la DIAN/);
  assert.match(visible, /Todavía no está en Google Play y no funciona en iPhone/);
});

test('la ayuda no carga recursos externos ni rastreadores y se enlaza desde todas las páginas', () => {
  assert.deepEqual([...help.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]), ['ayuda.js']);
  assert.doesNotMatch(help + read('ayuda.js'), /googletagmanager|google-analytics|gtag\(|facebook\.net|fbq\(|hotjar|utm_/i);
  assert.doesNotMatch(read('ayuda.js'), /fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
  for (const page of ['index.html', 'aviso-legal.html', 'privacidad.html', 'terminos.html']) assert.match(read(page), /href="ayuda\.html"/, page);
});

test('la ayuda explica el catálogo por tipo de negocio sin prometer precios y con su licencia', () => {
  const article = help.match(/<details class="help-article" id="catalogo-de-productos">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(article, 'falta el artículo catalogo-de-productos');
  const body = text(article);
  assert.match(body, /Más → Catálogo de productos/);
  assert.match(body, /no trae precios ni fotos/);
  assert.match(body, /ODbL/);
  const screen = readFileSync(new URL('../app/catalog-pack.tsx', import.meta.url), 'utf8');
  for (const label of ['Descargar catálogo', 'Buscar actualización', 'Eliminar catálogo de este teléfono', 'Origen de los datos']) {
    assert.ok(body.includes(label) && screen.includes(label), label);
  }
  for (const { name } of BUSINESS_TYPES) assert.match(body, new RegExp(name, 'i'), name);
});
