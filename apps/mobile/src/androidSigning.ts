export const SIGNING_MARKER = 'ANDROID_KEYSTORE_PATH';

const RELEASE_CONFIG = `        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
`;

const RELEASE_SIGNING = 'signingConfig = System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug';

type Block = { open: number; close: number };

function skipNonCode(src: string, i: number): number {
  if (src.startsWith('//', i)) {
    const end = src.indexOf('\n', i);
    return end < 0 ? src.length : end;
  }
  if (src.startsWith('/*', i)) {
    const end = src.indexOf('*/', i + 2);
    return end < 0 ? src.length : end + 2;
  }
  const quote = src[i];
  if (quote === '"' || quote === "'") {
    let j = i + 1;
    while (j < src.length && src[j] !== quote && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  return i;
}

function closing(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; ) {
    const next = skipNonCode(src, i);
    if (next !== i) { i = next; continue; }
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}' && --depth === 0) return i;
    i += 1;
  }
  throw new Error('build.gradle tiene llaves sin cerrar');
}

function topLevel(src: string, block: Block, visit: (i: number) => number | void): void {
  for (let i = block.open + 1; i < block.close; ) {
    const next = skipNonCode(src, i);
    if (next !== i) { i = next; continue; }
    const jump = visit(i);
    if (typeof jump === 'number') { i = jump; continue; }
    i = src[i] === '{' ? closing(src, i) + 1 : i + 1;
  }
}

const isIdent = (c: string | undefined) => c !== undefined && /[\w$.]/.test(c);

function child(src: string, parent: Block, name: string): Block | null {
  let found: Block | null = null;
  topLevel(src, parent, (i) => {
    if (found || !src.startsWith(name, i) || isIdent(src[i - 1])) return;
    const after = /^\s*\{/.exec(src.slice(i + name.length, i + name.length + 200));
    if (!after) return;
    const open = i + name.length + after[0].length - 1;
    found = { open, close: closing(src, open) };
    return found.close + 1;
  });
  return found;
}

function lineStart(src: string, i: number): number {
  return src.lastIndexOf('\n', i - 1) + 1;
}

function must(block: Block | null, what: string): Block {
  if (!block) throw new Error(`No se encontró el bloque ${what} en build.gradle`);
  return block;
}

function blocks(src: string) {
  const android = must(child(src, { open: -1, close: src.length }, 'android'), 'android');
  const buildTypes = must(child(src, android, 'buildTypes'), 'android.buildTypes');
  return {
    android,
    signingConfigs: child(src, android, 'signingConfigs'),
    buildTypes,
    release: must(child(src, buildTypes, 'release'), 'android.buildTypes.release'),
  };
}

function withReleaseConfig(src: string): string {
  const { buildTypes, signingConfigs } = blocks(src);
  if (!signingConfigs) {
    const at = lineStart(src, buildTypes.open);
    return `${src.slice(0, at)}    signingConfigs {\n${RELEASE_CONFIG}    }\n${src.slice(at)}`;
  }
  const existing = child(src, signingConfigs, 'release');
  if (existing) {
    const start = lineStart(src, existing.open);
    const end = src.indexOf('\n', existing.close);
    return src.slice(0, start) + RELEASE_CONFIG + src.slice(end < 0 ? src.length : end + 1);
  }
  const at = lineStart(src, signingConfigs.close);
  return src.slice(0, at) + RELEASE_CONFIG + src.slice(at);
}

function withReleaseSigning(src: string): string {
  const { release } = blocks(src);
  const lines: Array<{ start: number; end: number }> = [];
  topLevel(src, release, (i) => {
    if (!src.startsWith('signingConfig', i) || isIdent(src[i - 1]) || isIdent(src[i + 'signingConfig'.length])) return;
    const start = lineStart(src, i);
    const end = src.indexOf('\n', i);
    lines.push({ start, end: end < 0 ? src.length : end });
    return end < 0 ? src.length : end;
  });
  if (lines.length > 1) throw new Error('buildTypes.release tiene más de un signingConfig');
  const indent = (src.slice(lineStart(src, release.open)).match(/^[ \t]*/)?.[0] ?? '') + '    ';
  const line = lines[0];
  if (line) {
    const own = src.slice(line.start).match(/^[ \t]*/)?.[0] ?? indent;
    return `${src.slice(0, line.start)}${own}${RELEASE_SIGNING}${src.slice(line.end)}`;
  }
  const at = release.open + 1;
  return `${src.slice(0, at)}\n${indent}${RELEASE_SIGNING}${src.slice(at)}`;
}

export function patchReleaseSigning(gradle: string): string {
  if (gradle.includes(SIGNING_MARKER)) return gradle;
  return withReleaseSigning(withReleaseConfig(gradle));
}
