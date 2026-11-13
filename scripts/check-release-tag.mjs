import { readFileSync } from 'node:fs';
import { checkReleaseTag } from '../apps/mobile/src/releaseTag.ts';

const tag = process.argv[2];
if (!tag) {
  console.error('Uso: node scripts/check-release-tag.mjs <etiqueta>');
  process.exit(2);
}
const config = JSON.parse(readFileSync(new URL('../apps/mobile/app.json', import.meta.url), 'utf8'));
const result = checkReleaseTag(tag, config.expo?.version, config.expo?.android?.versionCode);
if (!result.ok) {
  console.error(`::error::${result.reason}`);
  process.exit(1);
}
console.log(`Etiqueta ${tag} coherente con app.json (versionCode ${config.expo.android.versionCode}).`);
