import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../../landing/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8');
const BASE = 'https://digita1web.github.io/surtivox-pos/';
const pages = readdirSync(dir).filter((name) => name.endsWith('.html') && name !== '404.html' && !/^google[0-9a-f]+\.html$/.test(name));
const urlOf = (page: string) => (page === 'index.html' ? BASE : BASE + page);
const sitemap = read('sitemap.xml');
const index = read('index.html');
const blocks = [...index.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]!));

test('cada página indexable tiene título, descripción y una sola URL canónica que figura en el sitemap', () => {
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
  assert.deepEqual([...listed].sort(), pages.map(urlOf).sort());
  for (const page of pages) {
    const html = read(page);
    assert.equal([...html.matchAll(/<link rel="canonical"/g)].length, 1, page);
    assert.match(html, new RegExp(`<link rel="canonical" href="${urlOf(page).replace(/[.]/g, '\\.')}">`), page);
    assert.match(html, /<title>[^<]{10,70}<\/title>/, page);
    assert.match(html, /<meta name="description" content="[^"]{60,170}"/, page);
    assert.doesNotMatch(html, /noindex/, page);
  }
});

test('el sitemap lleva fechas reales y no es más antiguo que el cambio de cada página', () => {
  const dates = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]!);
  assert.equal(dates.length, pages.length);
  for (const date of dates) {
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Date.parse(date) <= Date.now() + 86_400_000, date);
  }
  assert.doesNotMatch(sitemap, /changefreq|priority/);
});

test('robots.txt permite el rastreo y apunta al sitemap', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.doesNotMatch(robots, /^Disallow: \/\s*$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${BASE.replace(/[.]/g, '\\.')}sitemap\\.xml$`, 'm'));
});

test('el título de la portada lleva la marca y lo que busca la gente, y el h1 nombra la marca', () => {
  const title = index.match(/<title>([^<]+)<\/title>/)![1]!;
  assert.match(title, /^Surtivox POS/);
  assert.match(title, /punto de venta/i);
  assert.match(title, /gratis/i);
  assert.equal(index.match(/<meta property="og:title" content="([^"]+)"/)![1], title);
  assert.equal(index.match(/<meta name="twitter:title" content="([^"]+)"/)![1], title);
  assert.match(index, /<h1><span class="sr-only">Surtivox POS: <\/span>/);
});

test('los datos estructurados enlazan la app, la organización y el sitio por @id y los archivos que citan existen', () => {
  const graph = blocks.flatMap((block) => (block['@graph'] ?? [block]) as Record<string, any>[]);
  const ids = new Set(graph.map((node) => node['@id']).filter(Boolean));
  for (const node of graph) {
    for (const key of ['author', 'publisher']) {
      if (node[key]?.['@id']) assert.ok(ids.has(node[key]['@id']), `${node['@type']}.${key}`);
    }
  }
  for (const type of ['SoftwareApplication', 'Organization', 'WebSite']) {
    assert.ok(graph.some((node) => node['@type'] === type), type);
  }
  const app = graph.find((node) => node['@type'] === 'SoftwareApplication')!;
  const organization = graph.find((node) => node['@type'] === 'Organization')!;
  assert.equal(app.isAccessibleForFree, true);
  assert.equal(app.inLanguage, 'es-CO');
  assert.ok(app.screenshot.length >= 3);
  assert.equal(app.aggregateRating, undefined);
  for (const url of [app.image, organization.logo, ...app.screenshot] as string[]) {
    assert.ok(url.startsWith(BASE), url);
    assert.ok(existsSync(new URL(url.slice(BASE.length), dir)), url);
  }
});

test('la página 404 no se indexa y usa rutas absolutas para cargarse desde cualquier ruta', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) assert.match(match[1]!, /^https:\/\//, match[1]);
});

test('el archivo de verificación de Search Console contiene exactamente la línea que Google espera', () => {
  const files = readdirSync(dir).filter((name) => /^google[0-9a-f]+\.html$/.test(name));
  assert.equal(files.length, 1);
  assert.equal(read(files[0]!), `google-site-verification: ${files[0]}`);
});
