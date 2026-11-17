import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchReleaseSigning } from './androidSigning.ts';

const fixture = (name: string) => readFileSync(new URL(`../test-fixtures/${name}`, import.meta.url), 'utf8');
const templates = {
  'con =': fixture('build.gradle.template'),
  'sin = (plantilla de Expo de 2026-11)': fixture('build.gradle.call-syntax.template'),
};
const RELEASE_SIGNING = 'signingConfig = System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug';

function block(src: string, header: RegExp): string {
  const m = header.exec(src);
  assert.ok(m, String(header));
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
  }
  throw new Error('sin cerrar');
}

const releaseType = (src: string) => block(block(src, /buildTypes \{/), /\brelease \{/);
const debugType = (src: string) => block(block(src, /buildTypes \{/), /\bdebug \{/);
const signingConfigs = (src: string) => block(src, /signingConfigs \{/);

for (const [name, template] of Object.entries(templates)) {
  test(`plantilla ${name}: la variante release firma con la llave del entorno y la debug sigue con la de debug`, () => {
    const out = patchReleaseSigning(template);
    const release = releaseType(out);
    assert.equal(release.split(RELEASE_SIGNING).length - 1, 1, release);
    assert.doesNotMatch(release.replace(RELEASE_SIGNING, ''), /^\s*signingConfig\b/m);
    assert.match(debugType(out), /signingConfig =? ?signingConfigs\.debug/);
    const configs = signingConfigs(out);
    assert.match(configs, /storeFile file\(System\.getenv\("ANDROID_KEYSTORE_PATH"\)\)/);
    assert.match(configs, /storePassword System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
    assert.match(configs, /keyAlias System\.getenv\("ANDROID_KEY_ALIAS"\)/);
    assert.match(configs, /keyPassword System\.getenv\("ANDROID_KEY_PASSWORD"\)/);
    assert.match(configs, /storePassword 'android'/);
    assert.doesNotMatch(out, /storePassword '(?!android')/);
  });

  test(`plantilla ${name}: solo cambia la firma y aplicarlo dos veces no cambia nada`, () => {
    const once = patchReleaseSigning(template);
    assert.equal(patchReleaseSigning(once), once);
    const count = (src: string) => src.split('\n').reduce((m, line) => m.set(line, (m.get(line) ?? 0) + 1), new Map<string, number>());
    const after = count(once);
    const removed = [...count(template)].filter(([line, n]) => (after.get(line) ?? 0) < n).map(([line]) => line);
    assert.deepEqual(removed.length, 1, removed.join('\n'));
    assert.match(removed[0]!, /^\s+signingConfig =? ?signingConfigs\.debug$/);
    assert.equal(once.split('{').length, template.split('{').length + 2);
    assert.equal(once.split('}').length, template.split('}').length + 2);
  });
}

test('si la variante release no declara firma, se agrega sin tocar el resto', () => {
  const template = templates['sin = (plantilla de Expo de 2026-11)'];
  const without = template.replace(/(release \{\n(?:\s*\/\/[^\n]*\n)*)\s+signingConfig signingConfigs\.debug\n/, '$1');
  assert.notEqual(without, template);
  assert.equal(releaseType(patchReleaseSigning(without)).split(RELEASE_SIGNING).length - 1, 1);
});

test('no se deja engañar por comentarios, cadenas ni bloques release de otros lugares', () => {
  const tricky = `android {
    // release { signingConfig signingConfigs.debug }
    def label = "buildTypes { release { } }"
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
        }
    }
    flavorDimensions "tier"
    productFlavors {
        release { dimension "tier" }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            /* signingConfig = signingConfigs.debug } */
            signingConfig(signingConfigs.debug)
            minifyEnabled true
        }
    }
}
`;
  const out = patchReleaseSigning(tricky);
  assert.match(out, /productFlavors \{\n\s+release \{ dimension "tier" \}/);
  assert.match(out, /\/\/ release \{ signingConfig signingConfigs\.debug \}/);
  assert.match(out, /"buildTypes \{ release \{ \} \}"/);
  assert.match(out, /\/\* signingConfig = signingConfigs\.debug \} \*\//);
  const plain = out.replace(/\/\*[\s\S]*?\*\//, '').replace(/^.*def label.*\n/m, '').replace(/^\s*\/\/.*\n/m, '');
  const release = releaseType(plain);
  assert.match(release, new RegExp(`\\n\\s+${RELEASE_SIGNING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\\s+minifyEnabled true`));
  assert.match(debugType(plain), /signingConfig signingConfigs\.debug/);
});

test('si signingConfigs ya trae un release, se reemplaza en vez de duplicarlo', () => {
  const template = templates['con ='].replace(/(signingConfigs \{\n\s+debug \{[^}]*\}\n)/, "$1        release {\n            storeFile file('otra.keystore')\n        }\n");
  const out = patchReleaseSigning(template);
  assert.doesNotMatch(out, /otra\.keystore/);
  assert.equal((signingConfigs(out).match(/\brelease \{/g) ?? []).length, 1);
});

test('falla en voz alta, sin escribir nada, si falta la estructura que necesita', () => {
  assert.throws(() => patchReleaseSigning('plugins { }'), /bloque android en build.gradle/);
  assert.throws(() => patchReleaseSigning('android { }'), /android\.buildTypes/);
  assert.throws(() => patchReleaseSigning('android { buildTypes { debug { } } }'), /android\.buildTypes\.release/);
  assert.throws(() => patchReleaseSigning('android { buildTypes { release { '), /llaves sin cerrar/);
  assert.throws(() => patchReleaseSigning('android { buildTypes { release {\n signingConfig a\n signingConfig b\n } } }'), /más de un signingConfig/);
});
