import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UPDATE_CHECK_INTERVAL_MS, UPDATE_KEYS, checkUpdateNow, classifyResponse, compareVersions, decideNotice, describeUpdateResult,
  dismissUpdate, installedLabel, isCheckDue, loadUpdateNotice, parseRelease, parseVersion, versionFooter, type UpdateDeps, type UpdateSettings,
} from './appUpdate.ts';

const BASE = 'https://github.com/digita1web/surtivox-pos';

const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'v1.2.0',
  draft: false,
  prerelease: false,
  html_url: `${BASE}/releases/tag/v1.2.0`,
  assets: [{ name: 'Surtivox.apk', browser_download_url: `${BASE}/releases/download/v1.2.0/Surtivox.apk` }],
  ...over,
});

function memory(): UpdateSettings & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value); },
    remove: async (key) => { data.delete(key); },
  };
}

function setup(opts: { installed?: string | null; fetchLatest?: UpdateDeps['fetchLatest'] } = {}) {
  const settings = memory();
  let clock = 1_000_000_000;
  let calls = 0;
  const deps: UpdateDeps = {
    settings,
    now: () => clock,
    installedVersion: opts.installed === undefined ? '1.0.3' : opts.installed,
    fetchLatest: async () => {
      calls++;
      return opts.fetchLatest ? opts.fetchLatest() : { status: 200, body: release() };
    },
  };
  return { deps, settings, calls: () => calls, tick: (ms: number) => { clock += ms; } };
}

test('compara versiones numericamente: v1.10.0 es mayor que v1.9.0', () => {
  const a = parseVersion('v1.10.0')!;
  const b = parseVersion('v1.9.0')!;
  assert.equal(compareVersions(a, b), 1);
  assert.equal(compareVersions(b, a), -1);
  assert.equal(compareVersions(parseVersion('1.0.3')!, parseVersion('v1.0.3')!), 0);
  assert.equal(compareVersions(parseVersion('2.0.0')!, parseVersion('1.99.99')!), 1);
});

test('parseVersion acepta solo X.Y.Z con v opcional', () => {
  assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion(' 1.2.3 '), [1, 2, 3]);
  for (const bad of ['v1.2', '1.2.3.4', 'v1.2.3-beta', 'latest', '', 'v1.x.3', null, undefined, 12]) {
    assert.equal(parseVersion(bad), null, String(bad));
  }
});

test('parseRelease devuelve version, pagina y APK de la release', () => {
  assert.deepEqual(parseRelease(release()), {
    version: 'v1.2.0',
    htmlUrl: `${BASE}/releases/tag/v1.2.0`,
    apkUrl: `${BASE}/releases/download/v1.2.0/Surtivox.apk`,
  });
});

test('prefiere Surtivox.apk aunque haya otros APK y acepta cualquier .apk si no esta', () => {
  const other = { name: 'app-release.apk', browser_download_url: `${BASE}/releases/download/v1.2.0/app-release.apk` };
  const preferred = { name: 'Surtivox.apk', browser_download_url: `${BASE}/releases/download/v1.2.0/Surtivox.apk` };
  assert.equal(parseRelease(release({ assets: [other, preferred] }))?.apkUrl, preferred.browser_download_url);
  assert.equal(parseRelease(release({ assets: [preferred, other] }))?.apkUrl, preferred.browser_download_url);
  assert.equal(parseRelease(release({ assets: [other] }))?.apkUrl, other.browser_download_url);
  assert.equal(parseRelease(release({ assets: [{ ...other, name: 'APP.APK' }] }))?.apkUrl, other.browser_download_url);
});

test('sin APK en la release se queda solo con la pagina', () => {
  const parsed = parseRelease(release({ assets: [{ name: 'notas.txt', browser_download_url: `${BASE}/releases/download/v1.2.0/notas.txt` }] }));
  assert.equal(parsed?.apkUrl, null);
  assert.equal(parseRelease(release({ assets: undefined }))?.apkUrl, null);
});

test('descarta borradores y prereleases', () => {
  assert.equal(parseRelease(release({ draft: true })), null);
  assert.equal(parseRelease(release({ prerelease: true })), null);
});

test('rechaza respuestas mal formadas', () => {
  for (const bad of [null, undefined, 'texto', 42, [], {}, release({ tag_name: 7 }), release({ tag_name: 'nightly' }),
    release({ html_url: 42 }), release({ html_url: 'https://evil.example/releases/tag/v1.2.0' })]) {
    assert.equal(parseRelease(bad), null, JSON.stringify(bad));
  }
});

test('ignora enlaces de descarga que no son del repositorio', () => {
  const parsed = parseRelease(release({
    assets: [{ name: 'app.apk', browser_download_url: 'https://evil.example/app.apk' }, null, 5],
  }));
  assert.equal(parsed?.apkUrl, null);
});

test('limite de 24 horas entre consultas', () => {
  const t0 = 5_000_000_000;
  assert.equal(isCheckDue(null, t0), true);
  assert.equal(isCheckDue(t0, t0 + UPDATE_CHECK_INTERVAL_MS - 1), false);
  assert.equal(isCheckDue(t0, t0 + UPDATE_CHECK_INTERVAL_MS), true);
  assert.equal(isCheckDue(t0 + 10, t0), true);
  assert.equal(isCheckDue(Number.NaN, t0), true);
});

test('hay aviso cuando la release es mayor que la version instalada', async () => {
  const { deps } = setup();
  const notice = await loadUpdateNotice(deps);
  assert.equal(notice?.version, 'v1.2.0');
  assert.equal(notice?.apkUrl, `${BASE}/releases/download/v1.2.0/Surtivox.apk`);
});

test('no hay aviso si la version instalada es igual o mayor', async () => {
  assert.equal(await loadUpdateNotice(setup({ installed: '1.2.0' }).deps), null);
  assert.equal(await loadUpdateNotice(setup({ installed: '1.10.0' }).deps), null);
  assert.equal(await loadUpdateNotice(setup({ installed: null }).deps), null);
});

test('solo consulta una vez cada 24 horas aunque se abra varias veces', async () => {
  const { deps, calls, tick } = setup();
  await loadUpdateNotice(deps);
  await loadUpdateNotice(deps);
  tick(UPDATE_CHECK_INTERVAL_MS - 1);
  await loadUpdateNotice(deps);
  assert.equal(calls(), 1);
  tick(1);
  await loadUpdateNotice(deps);
  assert.equal(calls(), 2);
});

test('con el limite aun vigente sigue mostrando el aviso guardado sin consultar', async () => {
  const { deps, calls } = setup();
  await loadUpdateNotice(deps);
  const again = await loadUpdateNotice(deps);
  assert.equal(again?.version, 'v1.2.0');
  assert.equal(calls(), 1);
});

test('sin red no hay error, no hay aviso y se reintenta en la siguiente apertura', async () => {
  let fail = true;
  const { deps, calls, settings } = setup({
    fetchLatest: async () => { if (fail) throw new Error('sin red'); return { status: 200, body: release() }; },
  });
  assert.equal(await loadUpdateNotice(deps), null);
  assert.equal(settings.data.has(UPDATE_KEYS.lastCheckAt), false);
  fail = false;
  assert.equal((await loadUpdateNotice(deps))?.version, 'v1.2.0');
  assert.equal(calls(), 2);
});

test('una respuesta mal formada o un prerelease no producen aviso', async () => {
  assert.equal(await loadUpdateNotice(setup({ fetchLatest: async () => ({ status: 200, body: { tag_name: 'v9.9.9' } }) }).deps), null);
  assert.equal(await loadUpdateNotice(setup({ fetchLatest: async () => ({ status: 200, body: release({ prerelease: true }) }) }).deps), null);
  assert.equal(await loadUpdateNotice(setup({ fetchLatest: async () => ({ status: 200, body: 'no es json' }) }).deps), null);
});

test('un 404 quita el aviso anterior y un 5xx conserva el aviso sin marcar el limite', async () => {
  let status = 200;
  const { deps, tick, settings, calls } = setup({ fetchLatest: async () => ({ status, body: status === 200 ? release() : {} }) });
  assert.equal((await loadUpdateNotice(deps))?.version, 'v1.2.0');
  status = 500;
  tick(UPDATE_CHECK_INTERVAL_MS);
  const before = settings.data.get(UPDATE_KEYS.lastCheckAt);
  assert.equal((await loadUpdateNotice(deps))?.version, 'v1.2.0');
  assert.equal(settings.data.get(UPDATE_KEYS.lastCheckAt), before);
  status = 404;
  assert.equal(await loadUpdateNotice(deps), null);
  assert.equal(calls(), 3);
});

test('un 403 por limite de la API no marca las 24 horas y la siguiente apertura reintenta', async () => {
  let status = 403;
  const { deps, settings, calls } = setup({ fetchLatest: async () => ({ status, body: status === 200 ? release() : { message: 'rate limit' } }) });
  assert.equal(await loadUpdateNotice(deps), null);
  assert.equal(settings.data.has(UPDATE_KEYS.lastCheckAt), false);
  status = 429;
  assert.equal(await loadUpdateNotice(deps), null);
  assert.equal(settings.data.has(UPDATE_KEYS.lastCheckAt), false);
  status = 200;
  assert.equal((await loadUpdateNotice(deps))?.version, 'v1.2.0');
  assert.equal(calls(), 3);
  assert.ok(settings.data.has(UPDATE_KEYS.lastCheckAt));
});

test('clasifica las respuestas de GitHub', () => {
  assert.equal(classifyResponse(200), 'ok');
  assert.equal(classifyResponse(404), 'not_found');
  assert.equal(classifyResponse(403), 'rate_limited');
  assert.equal(classifyResponse(429), 'rate_limited');
  for (const status of [301, 400, 500, 502, 503]) assert.equal(classifyResponse(status), 'invalid', String(status));
});

test('un aviso descartado no se repite, pero una version aun mayor si avisa', async () => {
  const { deps, settings, tick } = setup();
  const notice = await loadUpdateNotice(deps);
  await dismissUpdate(settings, notice!);
  assert.equal(await loadUpdateNotice(deps), null);
  assert.equal(settings.data.get(UPDATE_KEYS.dismissed), 'v1.2.0');
  const newer = { tag_name: 'v1.3.0', html_url: `${BASE}/releases/tag/v1.3.0`, assets: [] };
  const next = setup({ fetchLatest: async () => ({ status: 200, body: newer }) });
  next.settings.data.set(UPDATE_KEYS.dismissed, 'v1.2.0');
  assert.equal((await loadUpdateNotice(next.deps))?.version, 'v1.3.0');
  tick(0);
});

test('decideNotice ignora versiones descartadas mayores o iguales', () => {
  const rel = parseRelease(release())!;
  assert.equal(decideNotice({ installedVersion: '1.0.3', release: rel, dismissedVersion: 'v1.2.0' }), null);
  assert.equal(decideNotice({ installedVersion: '1.0.3', release: rel, dismissedVersion: 'v1.3.0' }), null);
  assert.equal(decideNotice({ installedVersion: '1.0.3', release: rel, dismissedVersion: 'v1.1.0' })?.version, 'v1.2.0');
  assert.equal(decideNotice({ installedVersion: '1.0.3', release: rel, dismissedVersion: 'basura' })?.version, 'v1.2.0');
});

test('un valor guardado corrupto se ignora sin romper', async () => {
  const { deps, settings } = setup({ fetchLatest: async () => { throw new Error('sin red'); } });
  settings.data.set(UPDATE_KEYS.release, '{no es json');
  assert.equal(await loadUpdateNotice(deps), null);
  settings.data.set(UPDATE_KEYS.release, JSON.stringify({ version: 'v9.9.9', htmlUrl: 'https://evil.example/x', apkUrl: null }));
  assert.equal(await loadUpdateNotice(deps), null);
});

test('la consulta no envia datos del usuario ni identificadores', async () => {
  let args = 0;
  const { deps } = setup({ fetchLatest: async () => { args++; return { status: 200, body: release() }; } });
  await loadUpdateNotice(deps);
  assert.equal(args, 1);
  assert.equal(deps.fetchLatest.length, 0);
});

import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('la tarjeta aparece en Inicio y en Mas y abre el APK o, si no hay, la pagina de la release', () => {
  assert.match(source('../app/(tabs)/index.tsx'), /<UpdateNoticeCard notice=\{update\.notice\}/);
  assert.match(source('../app/(tabs)/more.tsx'), /<UpdateNoticeCard notice=\{update\.notice\}/);
  assert.match(source('./pos/UpdateNotice.tsx'), /Linking\.openURL\(notice\.apkUrl \?\? notice\.htmlUrl\)/);
  assert.match(source('./pos/UpdateNotice.tsx'), /Hay una versión nueva \(\$\{notice\.version\}\)/);
});

test('la consulta no manda token, identificador de instalacion ni datos de la tienda', () => {
  const code = source('./updateCheck.ts');
  assert.doesNotMatch(code, /install_id|getInstallId|authorization|token|store/i);
  assert.match(code, /RELEASES_LATEST_URL/);
});

test('Buscar actualizacion ignora el limite de 24 horas y consulta ahora', async () => {
  const { deps, calls } = setup();
  await loadUpdateNotice(deps);
  await loadUpdateNotice(deps);
  assert.equal(calls(), 1);
  const result = await checkUpdateNow(deps);
  assert.equal(calls(), 2);
  assert.equal(result.status, 'available');
});

test('resultado: hay una version nueva con el boton de descarga', async () => {
  const result = await checkUpdateNow(setup({ installed: '1.1.2', fetchLatest: async () => ({ status: 200, body: release({ tag_name: 'v1.1.3' }) }) }).deps);
  assert.equal(result.status, 'available');
  const message = describeUpdateResult(result);
  assert.equal(message.headline, 'Hay una versión nueva (v1.1.3)');
  assert.equal(message.installedLine, 'Versión instalada: v1.1.2');
  assert.equal(message.notice?.version, 'v1.1.3');
  assert.ok(message.notice?.apkUrl);
});

test('resultado: tienes la ultima version, con la version instalada siempre visible', async () => {
  const result = await checkUpdateNow(setup({ installed: '1.2.0' }).deps);
  const message = describeUpdateResult(result);
  assert.equal(message.headline, 'Tienes la última versión (v1.2.0)');
  assert.equal(message.installedLine, 'Versión instalada: v1.2.0');
  assert.equal(message.notice, null);
  const ahead = describeUpdateResult(await checkUpdateNow(setup({ installed: '1.9.0' }).deps));
  assert.equal(ahead.headline, 'Tienes la última versión (v1.9.0)');
});

test('resultado: sin conexion', async () => {
  const message = describeUpdateResult(await checkUpdateNow(setup({ fetchLatest: async () => { throw new Error('sin red'); } }).deps));
  assert.equal(message.headline, 'Sin conexión');
  assert.equal(message.installedLine, 'Versión instalada: v1.0.3');
});

test('resultado: GitHub limito las consultas y el limite de 24 h no se marca', async () => {
  for (const status of [403, 429]) {
    const { deps, settings } = setup({ fetchLatest: async () => ({ status, body: {} }) });
    const message = describeUpdateResult(await checkUpdateNow(deps));
    assert.equal(message.headline, 'GitHub limitó las consultas, intenta más tarde');
    assert.equal(settings.data.has(UPDATE_KEYS.lastCheckAt), false);
  }
});

test('resultado: respuesta no valida para cuerpo mal formado, prerelease y errores 5xx', async () => {
  const bodies = [{ status: 200, body: { tag_name: 'nightly' } }, { status: 200, body: 'no es json' }, { status: 200, body: release({ prerelease: true }) }, { status: 500, body: {} }];
  for (const response of bodies) {
    const message = describeUpdateResult(await checkUpdateNow(setup({ fetchLatest: async () => response }).deps));
    assert.equal(message.headline, 'Respuesta no válida', JSON.stringify(response).slice(0, 40));
  }
});

test('resultado: sin releases publicadas (404) cuenta como la ultima version', async () => {
  const message = describeUpdateResult(await checkUpdateNow(setup({ installed: '1.1.2', fetchLatest: async () => ({ status: 404, body: {} }) }).deps));
  assert.equal(message.headline, 'Tienes la última versión (v1.1.2)');
});

test('si la version instalada no se puede leer, lo dice y no afirma nada', async () => {
  const message = describeUpdateResult(await checkUpdateNow(setup({ installed: null }).deps));
  assert.equal(message.headline, 'No se pudo leer la versión instalada');
  assert.equal(message.installedLine, 'Versión instalada: no disponible');
  assert.equal(installedLabel('basura'), null);
  assert.equal(installedLabel('1.1.2'), 'v1.1.2');
});

test('la busqueda manual muestra la version aunque este descartada', async () => {
  const { deps, settings } = setup();
  settings.data.set(UPDATE_KEYS.dismissed, 'v1.2.0');
  assert.equal(await loadUpdateNotice(deps), null);
  assert.equal((await checkUpdateNow(deps)).status, 'available');
});

test('una busqueda manual exitosa marca el limite para que el aviso automatico no repita la consulta', async () => {
  const { deps, calls } = setup();
  await checkUpdateNow(deps);
  await loadUpdateNotice(deps);
  assert.equal(calls(), 1);
});

test('una busqueda manual fallida no marca el limite y el aviso automatico reintenta', async () => {
  let status = 403;
  const { deps, calls } = setup({ fetchLatest: async () => ({ status, body: status === 200 ? release() : {} }) });
  assert.equal((await checkUpdateNow(deps)).status, 'error');
  status = 200;
  assert.equal((await loadUpdateNotice(deps))?.version, 'v1.2.0');
  assert.equal(calls(), 2);
});

test('el boton esta en Mas, muestra la version instalada y no envia datos', () => {
  assert.match(source('../app/(tabs)/more.tsx'), /<UpdateCheckCard \/>/);
  const card = source('./pos/UpdateNotice.tsx');
  assert.match(card, /accessibilityLabel="Buscar actualización"/);
  assert.match(card, /Versión instalada: \$\{installedVersionText\(\)\}/);
  const code = source('./updateCheck.ts');
  assert.doesNotMatch(code, /install_id|getInstallId|authorization|token|store/i);
  assert.match(code, /checkUpdateNow\(deps\(\)\)/);
});

test('el pie de Más muestra la versión instalada y omite ese dato si no se puede leer', () => {
  assert.equal(versionFooter('1.1.4'), 'Surtivox POS · v1.1.4 · sin conexión');
  assert.equal(versionFooter('1.2.0'), 'Surtivox POS · v1.2.0 · sin conexión');
  assert.equal(versionFooter(null), 'Surtivox POS · sin conexión');
  assert.equal(versionFooter('basura'), 'Surtivox POS · sin conexión');
});
