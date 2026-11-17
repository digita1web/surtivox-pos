import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Config = { expo: Record<string, any> };
type Info = { platform: string; runtimeVersion: string; channel: string; version: string; versionCode: number };
type ChannelModule = { CHANNELS: string[]; withChannel: (config: Config, channel: string) => Config };
type RuntimeModule = {
  runtimeInfo: (fingerprint: unknown, config: Config) => Info;
  compareRuntime: (local: Info, published: unknown) => string | null;
};

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const build = read('.github/workflows/build-android.yml');
const ota = read('.github/workflows/ota-update.yml');
const appJson = () => JSON.parse(read('apps/mobile/app.json')) as Config;
const channelScript = new URL('scripts/set-update-channel.mjs', root);
const runtimeScript = new URL('scripts/runtime-info.mjs', root);
const loadChannel = async () => (await import(channelScript.href)) as ChannelModule;
const loadRuntime = async () => (await import(runtimeScript.href)) as RuntimeModule;
const HASH = 'e889d2dbc421e99680f827ef29578e11ed53ed94';

function step(workflow: string, name: string): string {
  const start = workflow.indexOf(`- name: ${name}\n`);
  assert.ok(start > 0, name);
  const next = workflow.indexOf('\n      - name:', start + 1);
  return workflow.slice(start, next < 0 ? undefined : next);
}

function script(workflow: string, name: string): string {
  const block = step(workflow, name);
  const run = block.slice(block.indexOf('run: |\n') + 'run: |\n'.length);
  return run.split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');
}

function order(workflow: string, names: string[]) {
  const positions = names.map((name) => workflow.indexOf(`- name: ${name}\n`));
  positions.forEach((p, i) => assert.ok(p > 0, names[i]));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, names.join(' → '));
}

test('app.json versionado escucha preview: un build o una OTA hechos a mano nunca caen en production', () => {
  const updates = appJson().expo.updates;
  assert.equal(updates.enabled, true);
  assert.equal(updates.requestHeaders['expo-channel-name'], 'preview');
  assert.equal(appJson().expo.runtimeVersion.policy, 'fingerprint');
});

test('withChannel fija el canal sin tocar el resto de la configuración y rechaza lo inválido', async () => {
  const { CHANNELS, withChannel } = await loadChannel();
  assert.deepEqual(CHANNELS, ['production', 'preview']);
  const base = appJson();
  const next = withChannel(base, 'production');
  assert.equal(next.expo.updates.requestHeaders['expo-channel-name'], 'production');
  assert.equal(next.expo.updates.url, base.expo.updates.url);
  assert.deepEqual({ ...next.expo, updates: base.expo.updates }, base.expo);
  assert.equal(base.expo.updates.requestHeaders['expo-channel-name'], 'preview');
  assert.throws(() => withChannel(base, 'development'), /Canal inválido/);
  assert.throws(() => withChannel(base, ''), /Canal inválido/);
  assert.throws(() => withChannel({ expo: {} }, 'preview'), /expo\.updates/);
  assert.throws(() => withChannel({ expo: { updates: { enabled: false, url: 'x' } } }, 'preview'), /expo\.updates/);
});

test('el script de canal escribe el archivo que se le pasa y, si falla, no lo modifica', () => {
  const dir = mkdtempSync(join(tmpdir(), 'channel-'));
  const file = join(dir, 'app.json');
  const original = read('apps/mobile/app.json');
  writeFileSync(file, original);
  const ok = spawnSync(process.execPath, [channelScript.pathname, 'production', file], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal((JSON.parse(readFileSync(file, 'utf8')) as Config).expo.updates.requestHeaders['expo-channel-name'], 'production');
  const before = readFileSync(file, 'utf8');
  const bad = spawnSync(process.execPath, [channelScript.pathname, 'main', file], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Canal inválido: main/);
  assert.equal(readFileSync(file, 'utf8'), before);
  assert.equal(read('apps/mobile/app.json'), original);
  rmSync(dir, { recursive: true, force: true });
});

test('runtimeInfo exige un hash de 40 caracteres, un canal válido y la política fingerprint', async () => {
  const { runtimeInfo } = await loadRuntime();
  const info = runtimeInfo({ hash: HASH, sources: [] }, appJson());
  assert.deepEqual(info, { platform: 'android', runtimeVersion: HASH, channel: 'preview', version: appJson().expo.version, versionCode: appJson().expo.android.versionCode });
  assert.throws(() => runtimeInfo({ hash: 'abc' }, appJson()), /hash válido/);
  assert.throws(() => runtimeInfo({}, appJson()), /hash válido/);
  const noChannel = appJson();
  delete noChannel.expo.updates.requestHeaders;
  assert.throws(() => runtimeInfo({ hash: HASH }, noChannel), /canal válido/);
  const appVersion = appJson();
  appVersion.expo.runtimeVersion = { policy: 'appVersion' };
  assert.throws(() => runtimeInfo({ hash: HASH }, appVersion), /fingerprint/);
});

test('compareRuntime solo deja pasar la misma huella y el mismo canal que la última release', async () => {
  const { compareRuntime } = await loadRuntime();
  const local: Info = { platform: 'android', runtimeVersion: HASH, channel: 'production', version: '1.1.8', versionCode: 14 };
  assert.equal(compareRuntime(local, { ...local }), null);
  assert.match(compareRuntime(local, null) ?? '', /no publica runtime-android\.json/);
  assert.match(compareRuntime(local, {}) ?? '', /no publica runtime-android\.json/);
  assert.match(compareRuntime(local, { ...local, channel: 'preview' }) ?? '', /canal preview/);
  assert.match(compareRuntime(local, { ...local, runtimeVersion: 'f'.repeat(40) }) ?? '', /Hace falta un APK nuevo/);
});

test('el build fija el canal (production solo en etiquetas) y calcula la huella antes del prebuild', () => {
  order(build, ['Verificar tipos y tests', 'Fijar el canal de actualizaciones', 'Calcular la huella nativa', 'Prebuild Android project', 'Build release APK', 'Verificar la huella y el canal dentro del APK', 'Subir APK como artefacto', 'Subir la huella como artefacto']);
  assert.match(script(build, 'Fijar el canal de actualizaciones'), /if \[ "\$\{GITHUB_REF_TYPE\}" = "tag" \]; then\n\s+CHANNEL=production\nelse\n\s+CHANNEL=preview\nfi\nnode scripts\/set-update-channel\.mjs "\$\{CHANNEL\}"/);
  assert.match(script(build, 'Calcular la huella nativa'), /fingerprint:generate --platform android/);
  assert.match(script(build, 'Calcular la huella nativa'), /runtime-info\.mjs write/);
});

function apkCheck(fingerprint: string, channel: string | null, expectedChannel: string) {
  const dir = mkdtempSync(join(tmpdir(), 'apk-'));
  const assets = join(dir, 'stage', 'assets');
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(assets, 'fingerprint'), fingerprint);
  const updates = { enabled: true, ...(channel ? { requestHeaders: { 'expo-channel-name': channel } } : {}) };
  writeFileSync(join(assets, 'app.config'), JSON.stringify({ updates }));
  const apkDir = join(dir, 'apps/mobile/android/app/build/outputs/apk/release');
  mkdirSync(apkDir, { recursive: true });
  const zip = spawnSync('python3', ['-I', '-m', 'zipfile', '-c', join(apkDir, 'app-release.apk'), 'assets'], { cwd: join(dir, 'stage'), encoding: 'utf8' });
  assert.equal(zip.status, 0, zip.stderr);
  writeFileSync(join(dir, 'runtime-android.json'), JSON.stringify({ runtimeVersion: HASH, channel: expectedChannel }));
  const summary = join(dir, 'summary');
  const result = spawnSync('bash', ['-c', script(build, 'Verificar la huella y el canal dentro del APK')], {
    cwd: dir,
    env: { PATH: process.env.PATH ?? '', RUNNER_TEMP: dir, UPDATE_CHANNEL: expectedChannel, GITHUB_STEP_SUMMARY: summary },
    encoding: 'utf8',
  });
  const out = { status: result.status, output: result.stdout + result.stderr, summary: result.status === 0 ? readFileSync(summary, 'utf8') : '' };
  rmSync(dir, { recursive: true, force: true });
  return out;
}

test('el build falla si la huella o el canal que quedaron dentro del APK no son los esperados', () => {
  const good = apkCheck(HASH, 'production', 'production');
  assert.equal(good.status, 0, good.output);
  assert.match(good.summary, new RegExp(`Canal \`production\`, huella nativa \`${HASH}\``));
  const wrongHash = apkCheck('aa5b0584fa4c3a08a362b346711ee395b2ab4d14', 'production', 'production');
  assert.equal(wrongHash.status, 1);
  assert.match(wrongHash.output, /no es la calculada/);
  const noChannel = apkCheck(HASH, null, 'production');
  assert.equal(noChannel.status, 1);
  assert.match(noChannel.output, /escucha el canal ''/);
  const preview = apkCheck(HASH, 'preview', 'production');
  assert.equal(preview.status, 1);
});

test('la release publica la huella junto al APK y solo si es del canal production', () => {
  const release = build.slice(build.indexOf('\n  release:'));
  order(release, ['Descargar APK', 'Descargar la huella', 'Exigir el canal production en la huella de la release', 'Create GitHub Release']);
  assert.match(release, /name: runtime-android\n\s+path: release-apk/);
  assert.match(release, /files: \|\n\s+release-apk\/Surtivox\.apk\n\s+release-apk\/runtime-android\.json/);
  assert.match(script(release, 'Exigir el canal production en la huella de la release'), /"\$\{CHANNEL\}" != "production"/);
});

test('el workflow OTA es solo manual, de lectura, y revisa el token y la rama antes de todo', () => {
  assert.match(ota, /^on:\n {2}workflow_dispatch:\n/m);
  assert.doesNotMatch(ota, /^\s+(push|pull_request|schedule|release):/m);
  assert.match(ota, /^permissions:\n {2}contents: read\n/m);
  assert.match(ota, /concurrency:\n\s+group: ota-update\n\s+cancel-in-progress: false/);
  assert.match(ota, /channel:[\s\S]*?type: choice\n\s+options:\n\s+- preview\n\s+- production\n\s+default: preview/);
  assert.match(ota, /action:[\s\S]*?options:\n\s+- publicar\n\s+- volver-al-apk\n\s+default: publicar/);
  assert.ok(ota.indexOf('- name: Revisar los requisitos') < ota.indexOf('- name: Checkout'));
  const checks = script(ota, 'Revisar los requisitos');
  assert.match(checks, /-z "\$\{EXPO_TOKEN:-\}"/);
  assert.match(checks, /"\$\{CHANNEL\}" = "production" \] && \[ "\$\{GITHUB_REF\}" != "refs\/heads\/main"/);
});

test('una OTA pasa el gate completo, fija el canal, calcula la huella y en production la compara con la release', () => {
  order(ota, ['Install dependencies', 'Verificar tipos y tests', 'Check Expo SDK alignment', 'Fijar el canal de actualizaciones', 'Calcular la huella nativa', 'Comparar con la huella de la última release', 'Publicar la actualización', 'Volver al código del APK']);
  assert.equal(script(ota, 'Verificar tipos y tests'), script(build, 'Verificar tipos y tests'));
  assert.equal(script(ota, 'Calcular la huella nativa').split('\n').slice(0, 3).join('\n'), script(build, 'Calcular la huella nativa').split('\n').slice(0, 3).join('\n'));
  assert.match(step(ota, 'Verificar tipos y tests'), /if: inputs\.action == 'publicar'/);
  const compare = step(ota, 'Comparar con la huella de la última release');
  assert.match(compare, /if: inputs\.channel == 'production'/);
  assert.match(compare, /releases\/latest\/download\/runtime-android\.json/);
  assert.match(compare, /runtime-info\.mjs check/);
});

test('eas-cli va fijado a una versión exacta, con --environment, y los inputs nunca se interpolan dentro de un run', () => {
  const uses = [...ota.matchAll(/eas-cli@([^\s]+)/g)].map((m) => m[1]);
  assert.equal(uses.length, 2);
  for (const version of uses) assert.match(version!, /^\d+\.\d+\.\d+$/);
  assert.equal(new Set(uses).size, 1);
  assert.equal((ota.match(/eas-cli/g) ?? []).length, 2);
  assert.match(step(ota, 'Publicar la actualización'), /update --channel "\$\{CHANNEL\}" --environment "\$\{CHANNEL\}" --platform android --message "\$\{MESSAGE\}" --non-interactive/);
  assert.match(step(ota, 'Volver al código del APK'), /update:roll-back-to-embedded --channel "\$\{CHANNEL\}" --runtime-version "\$\{RUNTIME_VERSION\}"/);
  for (const line of ota.split('\n').filter((l) => /^\s+run: /.test(l) || /^ {10}\S/.test(l))) {
    assert.doesNotMatch(line, /\$\{\{\s*inputs\./, line);
  }
  assert.match(ota, /CHANNEL: \$\{\{ inputs\.channel \}\}\n\s+ACTION: \$\{\{ inputs\.action \}\}\n\s+MESSAGE: \$\{\{ inputs\.message \}\}/);
});

test('el bundle de la OTA lleva las mismas variables públicas que el del APK', () => {
  const vars = (workflow: string) => [...workflow.matchAll(/^\s+(EXPO_PUBLIC_[A-Z_]+): (.+)$/gm)].map((m) => `${m[1]}=${m[2]}`).sort();
  assert.ok(vars(build).length > 0);
  assert.deepEqual(vars(ota), vars(build));
  const used = new Set<string>();
  for (const dir of ['apps/mobile/src/', 'apps/mobile/app/']) {
    for (const name of readdirSync(new URL(dir, root), { recursive: true, encoding: 'utf8' })) {
      if (!/\.tsx?$/.test(name) || name.endsWith('.test.ts')) continue;
      for (const m of read(`${dir}${name}`).matchAll(/EXPO_PUBLIC_[A-Z_]+/g)) used.add(m[0]);
    }
  }
  assert.ok(used.size > 0);
  for (const name of used) assert.ok(vars(ota).some((v) => v.startsWith(`${name}=`)), name);
});
