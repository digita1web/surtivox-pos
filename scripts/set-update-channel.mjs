import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CHANNELS = ['production', 'preview'];

export function withChannel(config, channel) {
  if (!CHANNELS.includes(channel)) throw new Error(`Canal inválido: ${channel}. Usa ${CHANNELS.join(' o ')}.`);
  const updates = config?.expo?.updates;
  if (!updates || updates.enabled !== true || typeof updates.url !== 'string') {
    throw new Error('app.json no tiene expo.updates habilitado con una url.');
  }
  return {
    ...config,
    expo: { ...config.expo, updates: { ...updates, requestHeaders: { ...(updates.requestHeaders ?? {}), 'expo-channel-name': channel } } },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const channel = process.argv[2];
  const path = process.argv[3] ?? new URL('../apps/mobile/app.json', import.meta.url);
  try {
    const next = withChannel(JSON.parse(readFileSync(path, 'utf8')), channel);
    writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Canal de actualizaciones: ${channel}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
