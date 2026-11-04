import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGAL_VERSION } from './legal.ts';
import { PRIVACY_SECTIONS } from './legalText.ts';

const html = readFileSync(new URL('../../../landing/privacidad.html', import.meta.url), 'utf8');
const article = html.match(/<article class="legal-card">([\s\S]*?)<\/article>/)?.[1] ?? '';

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const plain = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const blocks = [...article.matchAll(/<(h2|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1]!, text: plain(m[2]!) }));

test('the web page repeats every section of the in-app privacy notice, in order and word for word', () => {
  assert.ok(blocks.length > 0, 'no se pudo leer el articulo de privacidad.html');
  let cursor = -1;
  for (const section of PRIVACY_SECTIONS) {
    const at = blocks.findIndex((b, i) => i > cursor && b.tag === 'h2' && b.text === section.title);
    assert.ok(at > cursor, `falta o esta fuera de orden el titulo: ${section.title}`);
    const body = blocks[at + 1];
    assert.equal(body?.tag, 'p', `falta el parrafo de: ${section.title}`);
    assert.equal(body?.text, section.body, `el texto difiere en: ${section.title}`);
    cursor = at + 1;
  }
});

test('the web page keeps the website-only sections after the app notice', () => {
  const titles = blocks.filter((b) => b.tag === 'h2').map((b) => b.text);
  assert.deepEqual(titles.slice(PRIVACY_SECTIONS.length).map((t) => t.split('.')[0]), ['10', '11', '12']);
});

test('the page shows the same version as the app and does not contradict the license or the contact', () => {
  assert.ok(html.includes(`Versión del aviso: ${LEGAL_VERSION}`));
  assert.doesNotMatch(article, /\bMIT\b|código abierto|open source/i);
  assert.ok(article.includes('mailto:contacto3rillodivino@gmail.com'));
});
