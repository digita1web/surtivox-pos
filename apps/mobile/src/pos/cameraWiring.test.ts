import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);

function sources(dir: string): string[] {
  return readdirSync(new URL(`${dir}/`, root), { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => `${dir}/${name.replaceAll('\\', '/')}`);
}

const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('solo ScannerCamera toca la cámara directamente, para que todo escáner use la máquina de estados', () => {
  const offenders = [...sources('app'), ...sources('src')]
    .filter((path) => path !== 'src/pos/ScannerCamera.tsx')
    .filter((path) => /\bCameraView\b|\buseCameraPermissions\b/.test(read(path)));
  assert.deepEqual(offenders, []);
});

test('el escáner de un solo código usa ScannerCamera y no administra permisos por su cuenta', () => {
  const modal = read('src/pos/ScanModal.tsx');
  assert.match(modal, /import \{ ScannerCamera \} from '\.\/ScannerCamera'/);
  assert.match(modal, /<ScannerCamera /);
  assert.doesNotMatch(modal, /requestPermission/);
});

test('ScannerCamera sigue conectando la máquina de estados con el foco y el segundo plano', () => {
  const camera = read('src/pos/ScannerCamera.tsx');
  assert.match(camera, /reduceCamera/);
  assert.match(camera, /useFocusEffect/);
  assert.match(camera, /AppState\.addEventListener/);
});
