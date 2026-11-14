import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const config = read('../../../.github/dependabot.yml');
const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };

function ignoredMajors(): { pattern: RegExp; types: string[] }[] {
  const entries: { pattern: RegExp; types: string[] }[] = [];
  const re = /- dependency-name: "([^"]+)"\n\s+update-types: \[([^\]]*)\]/g;
  for (const match of config.matchAll(re)) {
    const glob = match[1]!.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    entries.push({ pattern: new RegExp(`^${glob}$`), types: match[2]!.match(/semver-(\w+)/g)!.map((t) => t.slice(7)) });
  }
  return entries;
}

test('las dependencias fijadas al SDK de Expo no reciben subidas mayores automáticas', () => {
  const ignored = ignoredMajors();
  assert.ok(ignored.length > 0);
  const aligned = Object.entries(pkg.dependencies).filter(([, range]) => range.startsWith('~'));
  assert.ok(aligned.length > 5);
  const uncovered = aligned
    .map(([name]) => name)
    .filter((name) => !ignored.some((entry) => entry.pattern.test(name) && entry.types.includes('major')));
  assert.deepEqual(uncovered, []);
});

test('React Native y React ignoran también las subidas minor, que en su esquema 0.x rompen compatibilidad', () => {
  const ignored = ignoredMajors();
  for (const name of ['react-native', 'react']) {
    const entry = ignored.find((candidate) => candidate.pattern.test(name));
    assert.ok(entry, name);
    assert.ok(entry!.types.includes('major') && entry!.types.includes('minor'), name);
  }
});

test('Wrangler no sube de versión mayor sin revisión', () => {
  const entry = ignoredMajors().find((candidate) => candidate.pattern.test('wrangler'));
  assert.ok(entry && entry.types.includes('major'));
});

test('GitHub Actions sigue configurado y no se ignora', () => {
  assert.match(config, /package-ecosystem: github-actions/);
  assert.doesNotMatch(config, /dependency-name: "actions\//);
});
