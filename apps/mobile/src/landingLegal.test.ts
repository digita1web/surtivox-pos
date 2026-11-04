import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGAL_VERSION } from './legal.ts';
import { PRIVACY_SECTIONS, TERMS_SECTIONS, type LegalSection } from './legalText.ts';

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const plain = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function load(file: string) {
  const html = readFileSync(new URL(`../../../landing/${file}`, import.meta.url), 'utf8');
  const article = html.match(/<article class="legal-card">([\s\S]*?)<\/article>/)?.[1] ?? '';
  const blocks = [...article.matchAll(/<(h2|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1]!, text: plain(m[2]!) }));
  return { html, article, blocks };
}

const pages = [
  { file: 'privacidad.html', sections: PRIVACY_SECTIONS, versionLabel: 'Versión del aviso', webOnly: ['10', '11', '12'] },
  { file: 'terminos.html', sections: TERMS_SECTIONS, versionLabel: 'Versión de los términos', webOnly: ['12'] },
] as const;

for (const page of pages) {
  const { html, article, blocks } = load(page.file);

  test(`${page.file} repite cada seccion de la app, en orden y palabra por palabra`, () => {
    assert.ok(blocks.length > 0, `no se pudo leer el articulo de ${page.file}`);
    let cursor = -1;
    for (const section of page.sections as readonly LegalSection[]) {
      const at = blocks.findIndex((b, i) => i > cursor && b.tag === 'h2' && b.text === section.title);
      assert.ok(at > cursor, `falta o esta fuera de orden el titulo: ${section.title}`);
      const body = blocks[at + 1];
      assert.equal(body?.tag, 'p', `falta el parrafo de: ${section.title}`);
      assert.equal(body?.text, section.body, `el texto difiere en: ${section.title}`);
      cursor = at + 1;
    }
  });

  test(`${page.file} conserva solo secciones propias del sitio despues de las de la app`, () => {
    const titles = blocks.filter((b) => b.tag === 'h2').map((b) => b.text);
    assert.deepEqual(titles.slice(page.sections.length).map((t) => t.split('.')[0]), [...page.webOnly]);
  });

  test(`${page.file} muestra la misma version que la app y no contradice la licencia`, () => {
    assert.ok(html.includes(`${page.versionLabel}: ${LEGAL_VERSION}`));
    assert.doesNotMatch(article, /\bMIT\b|código abierto|open source/i);
    assert.ok(article.includes('mailto:contacto3rillodivino@gmail.com'));
  });
}
