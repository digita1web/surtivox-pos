import { readFileSync, writeFileSync } from 'node:fs';
import { patchReleaseSigning } from '../apps/mobile/src/androidSigning.ts';

const target = process.argv[2];
if (!target) {
  console.error('Uso: node scripts/patch-android-signing.mjs <ruta a build.gradle>');
  process.exit(2);
}
const current = readFileSync(target, 'utf8');
const patched = patchReleaseSigning(current);
if (patched !== current) writeFileSync(target, patched);
console.log(patched === current ? 'build.gradle ya tenia la firma de release' : 'Firma de release aplicada a build.gradle');
