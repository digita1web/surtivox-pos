import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../../landing/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8');
const html = read('index.html');
const APK = 'https://github.com/digita1web/surtivox-pos/releases/latest/download/Surtivox.apk';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const text = (fragment: string) => fragment.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const visible = text(main);

function jsonLd(): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]!));
}

test('cada id es único y cada enlace interno de la página apunta a un id que existe', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!);
  assert.equal(new Set(ids).size, ids.length);
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]!);
  assert.ok(anchors.length >= 6);
  assert.deepEqual(anchors.filter((anchor) => !ids.includes(anchor)), []);
});

test('las páginas legales enlazan a anclas de la portada que existen', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!);
  const pages = readdirSync(dir).filter((name) => name.endsWith('.html') && name !== 'index.html');
  assert.ok(pages.length >= 3);
  for (const page of pages) {
    for (const match of read(page).matchAll(/href="index\.html#([^"]+)"/g)) {
      assert.ok(ids.includes(match[1]!), `${page}: #${match[1]}`);
    }
  }
});

test('hay un solo h1 y los títulos no se saltan niveles', () => {
  const levels = [...main.matchAll(/<h([1-4])[\s>]/g)].map((match) => Number(match[1]));
  assert.equal(levels.filter((level) => level === 1).length, 1);
  assert.ok(!levels.includes(4));
  for (let index = 1; index < levels.length; index++) {
    assert.ok(levels[index]! - levels[index - 1]! <= 1, `salto de h${levels[index - 1]} a h${levels[index]}`);
  }
});

test('las preguntas frecuentes visibles son las mismas que declara el JSON-LD', () => {
  const faq = jsonLd().find((block) => block['@type'] === 'FAQPage') as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  const shown = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)]
    .map((match) => ({ name: text(match[1]!).trim(), text: text(match[2]!).trim() }));
  assert.ok(shown.length >= 8);
  assert.deepEqual(faq.mainEntity.map((item) => ({ name: item.name, text: item.acceptedAnswer.text })), shown);
});

test('todos los botones de descarga apuntan al último release y no a una versión fija', () => {
  const links = [...html.matchAll(/<a [^>]*href="([^"]*Surtivox\.apk)"/g)].map((match) => match[1]!);
  for (const link of links) assert.equal(link, APK);
  assert.match(html, /<a class="button button-primary button-large" href="[^"]+Surtivox\.apk">/);
  assert.match(html, /<a class="get-badge" href="[^"]+Surtivox\.apk">/);
  assert.match(html, /<div class="mobile-download">[\s\S]*?<a class="button button-primary" href="[^"]+Surtivox\.apk">/);
  assert.equal(links.length, 3);
  assert.doesNotMatch(html, /releases\/download\/v\d/);
  const app = jsonLd().find((block) => block['@type'] === 'SoftwareApplication') as { downloadUrl: string; offers: { price: string } };
  assert.equal(app.downloadUrl, APK);
  assert.equal(app.offers.price, '0');
});

test('la portada dice lo que la app hace: pagos locales, fiado, funciones con ventaja y funcionamiento sin internet', () => {
  for (const phrase of ['Nequi', 'Daviplata', 'fiado', 'Precios de referencia', 'Catálogo comunitario', 'Éxito', 'Jumbo', 'Olímpica', 'sin internet', 'gratis']) {
    assert.ok(visible.toLowerCase().includes(phrase.toLowerCase()), phrase);
  }
});

test('la portada es honesta con lo que no hace ni promete', () => {
  for (const limit of [
    /solo para <strong>Android<\/strong>/,
    /aún no está en Google Play/,
    /versión de pruebas/,
    /no facturas electrónicas<\/strong> de la DIAN/,
    /Surtivox no tiene relación con ellas/,
    /Es opcional/,
  ]) {
    assert.match(main, limit);
  }
});

test('la portada no afirma lo que no se pudo comprobar en la app ni contradice la licencia', () => {
  assert.doesNotMatch(visible, /más vendidos/i);
  assert.doesNotMatch(html, /código fuente/i);
  assert.doesNotMatch(visible, /nunca se cae|100 % seguro|sin riesgo|garantizad/i);
  assert.doesNotMatch(visible, /anónim/i);
});

test('todas las imágenes de la app tienen texto alternativo y existen, y no se cargan recursos externos', () => {
  const images = [...html.matchAll(/<img ([^>]*)>/g)].map((match) => match[1]!);
  assert.ok(images.length >= 8);
  for (const attributes of images) {
    const src = attributes.match(/src="([^"]+)"/)![1]!;
    assert.ok(existsSync(new URL(src, dir)), src);
    assert.doesNotMatch(src, /^https?:/);
    if (src.includes('screen-')) assert.match(attributes, /alt="[^"]{12,}"/, src);
  }
  for (const match of html.matchAll(/<(?:script|link)[^>]*\s(?:src|href)="([^"]+)"/g)) {
    const target = match[1]!;
    if (/rel="canonical"/.test(match[0]!)) continue;
    assert.doesNotMatch(target, /^https?:\/\//, target);
  }
});

test('el título y la descripción caben en los resultados de búsqueda', () => {
  const description = html.match(/<meta name="description" content="([^"]+)"/)![1]!;
  assert.ok(description.length >= 70 && description.length <= 170, String(description.length));
  const title = html.match(/<title>([^<]+)<\/title>/)![1]!;
  assert.ok(title.length <= 70);
  assert.equal(html.match(/<meta property="og:description" content="([^"]+)"/)![1], description);
});
