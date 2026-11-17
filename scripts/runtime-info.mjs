import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHANNELS } from './set-update-channel.mjs';

const HASH = /^[0-9a-f]{40}$/;

export function runtimeInfo(fingerprint, config) {
  const hash = fingerprint?.hash;
  if (typeof hash !== 'string' || !HASH.test(hash)) throw new Error('La huella no trae un hash válido.');
  const expo = config?.expo ?? {};
  const channel = expo.updates?.requestHeaders?.['expo-channel-name'];
  if (!CHANNELS.includes(channel)) throw new Error(`app.json no tiene un canal válido: ${channel}.`);
  if (expo.runtimeVersion?.policy !== 'fingerprint') throw new Error('runtimeVersion debe usar la política fingerprint.');
  return { platform: 'android', runtimeVersion: hash, channel, version: expo.version, versionCode: expo.android?.versionCode };
}

export function compareRuntime(local, published) {
  if (!published || typeof published.runtimeVersion !== 'string') {
    return 'La última release no publica runtime-android.json: ningún APK instalado puede recibir esta actualización.';
  }
  if (published.channel !== local.channel) {
    return `La última release escucha el canal ${published.channel} y esta actualización es para ${local.channel}.`;
  }
  if (published.runtimeVersion !== local.runtimeVersion) {
    return `La huella nativa cambió (release ${published.version}: ${published.runtimeVersion}, este código: ${local.runtimeVersion}). Hace falta un APK nuevo, no una OTA.`;
  }
  return null;
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, a, b, out] = process.argv.slice(2);
  try {
    if (command === 'write') {
      const info = runtimeInfo(readJson(a), readJson(b));
      writeFileSync(out, `${JSON.stringify(info, null, 2)}\n`);
      console.log(`Huella ${info.platform} ${info.runtimeVersion} (canal ${info.channel}, versión ${info.version})`);
    } else if (command === 'check') {
      const problem = compareRuntime(readJson(a), readJson(b));
      if (problem) throw new Error(problem);
      console.log('La huella coincide con la última release.');
    } else {
      throw new Error('Uso: runtime-info.mjs write <huella.json> <app.json> <salida.json> | check <local.json> <publicada.json>');
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
