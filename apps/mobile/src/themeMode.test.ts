import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_APPEARANCE, resolveScheme, statusBarToneFor, systemSchemeOverride } from './themeMode.ts';

test('the app is light by default and ignores the phone dark mode', () => {
  assert.equal(APP_APPEARANCE, 'light');
  for (const system of ['light', 'dark', null, undefined] as const) {
    assert.equal(resolveScheme(APP_APPEARANCE, system), 'light');
  }
});

test('following the system is still possible and falls back to light', () => {
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', 'light'), 'light');
  assert.equal(resolveScheme('system', null), 'light');
  assert.equal(resolveScheme('dark', 'light'), 'dark');
});

test('status bar icons are dark on a light app so they stay visible', () => {
  assert.equal(statusBarToneFor('light'), 'dark');
  assert.equal(statusBarToneFor('dark'), 'light');
  assert.equal(statusBarToneFor('system'), 'auto');
});

test('the system color scheme is only overridden when the app picks one', () => {
  assert.equal(systemSchemeOverride('light'), 'light');
  assert.equal(systemSchemeOverride('dark'), 'dark');
  assert.equal(systemSchemeOverride('system'), 'unspecified');
});
