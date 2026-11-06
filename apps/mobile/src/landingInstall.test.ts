import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const dir = new URL('../../../landing/', import.meta.url);
const html = readFileSync(new URL('index.html', dir), 'utf8');
const css = readFileSync(new URL('styles.css', dir), 'utf8');
const script = readFileSync(new URL('app.js', dir), 'utf8');

const EXPECTED_QR_URL = 'https://digita1web.github.io/surtivox-pos/#instala';
const APK = 'https://github.com/digita1web/surtivox-pos/releases/latest/download/Surtivox.apk';
const section = html.slice(html.indexOf('<section class="section section-get"'), html.indexOf('</section>', html.indexOf('<section class="section section-get"')));

test('existe la seccion Instala Surtivox antes del pie de pagina', () => {
  assert.ok(section.includes('id="instala"'));
  assert.match(section, /<h2 id="instala-titulo">Instala Surtivox<\/h2>/);
  assert.match(section, /sin conexión/);
  assert.ok(html.indexOf('id="instala"') < html.indexOf('<footer class="site-footer">'));
});

test('el encabezado fijo tiene un enlace Descargar que lleva a la seccion', () => {
  const header = html.slice(html.indexOf('<header class="site-header">'), html.indexOf('</header>'));
  assert.match(header, /<a class="button button-small" href="#instala">Descargar<\/a>/);
  assert.match(css, /\.site-header\s*\{[^}]*position:\s*sticky/);
});

test('la insignia usa el enlace fijo de Surtivox.apk y muestra la version', () => {
  assert.match(section, new RegExp(`<a class="get-badge" href="${APK.replace(/[.]/g, '\\.')}">`));
  assert.match(section, /Descarga directa \(APK\)/);
  assert.match(section, /data-release-version/);
  assert.match(script, /querySelectorAll\(selector\)/);
});

test('Google Play aparece solo como etiqueta sin enlace', () => {
  assert.match(section, /<p class="get-soon">Google Play: próximamente<\/p>/);
  assert.doesNotMatch(section, /play\.google\.com|<a[^>]*>[^<]*Google Play/i);
  assert.doesNotMatch(section, /app-store|apple\.com/i);
});

test('los enlaces de descarga no llevan parametros de seguimiento ni analitica', () => {
  for (const source of [html, script]) {
    assert.doesNotMatch(source, /utm_|fbclid|gclid|[?&]ref=|googletagmanager|google-analytics|gtag\(|plausible|matomo/i);
  }
  assert.ok(!APK.includes('?'));
});

test('el QR es un archivo propio, sin referencias externas, y solo se muestra en pantallas anchas', () => {
  assert.ok(existsSync(new URL('assets/qr-descarga.svg', dir)));
  const svg = readFileSync(new URL('assets/qr-descarga.svg', dir), 'utf8');
  assert.match(svg, /viewBox="0 0 45 45"/);
  assert.doesNotMatch(svg, /<script|xlink:href|href=|<image|<foreignObject/i);
  assert.match(css, /\.get-qr\s*\{[^}]*display:\s*none/);
  assert.match(css, /@media \(min-width: 900px\)\s*\{\s*\.get-qr\s*\{\s*display:\s*block/);
  assert.match(section, /<img src="assets\/qr-descarga\.svg"[^>]*alt="Código QR/);
});

test('el QR fija la URL esperada de la landing con el ancla #instala', () => {
  const svg = readFileSync(new URL('assets/qr-descarga.svg', dir), 'utf8');
  const readme = readFileSync(new URL('README.md', dir), 'utf8');
  assert.match(svg, /<title id="qr-title">Código QR para descargar Surtivox<\/title>/);
  assert.ok(svg.includes(`<desc id="qr-desc">Apunta la cámara del celular a este código para abrir ${EXPECTED_QR_URL}</desc>`));
  assert.match(svg, /aria-labelledby="qr-title qr-desc"/);
  assert.ok(readme.includes(EXPECTED_QR_URL));
  assert.ok(html.includes('<link rel="canonical" href="https://digita1web.github.io/surtivox-pos/">'));
  assert.ok(EXPECTED_QR_URL.startsWith('https://digita1web.github.io/surtivox-pos/'));
  assert.ok(!EXPECTED_QR_URL.includes('?'));
});

test('el QR tiene zona de silencio de 4 modulos y modulos oscuros sobre fondo blanco', () => {
  const svg = readFileSync(new URL('assets/qr-descarga.svg', dir), 'utf8');
  assert.match(svg, /<rect width="45" height="45" fill="#FFFFFF"\/>/);
  assert.match(svg, /<path d="M4 4h7v1h-7z/);
  assert.match(svg, /fill="#102A24"/);
});

test('la ilustracion usa el icono propio de la app', () => {
  assert.match(section, /<img src="assets\/icon-180\.png"/);
  assert.ok(existsSync(new URL('assets/icon-180.png', dir)));
});
