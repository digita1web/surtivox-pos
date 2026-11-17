import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiagnosticsText,
  formatLastError,
  truncateErrorMessage,
  type DiagnosticsData,
} from './diagnostics.ts';

const base: DiagnosticsData = {
  appVersion: '1.0.3',
  runtimeVersion: 'fingerprint-123',
  updateId: null,
  updateChannel: 'production',
  launchedFromUpdate: false,
  dbSizeBytes: 2048,
  migrations: 12,
  lastMigration: '0011_catalog_client',
  lastBackupAt: Date.UTC(2026, 10, 1, 10, 0, 0),
  cameraRestarts: '2',
  catalogConfigured: true,
  catalogOptIn: true,
  catalogPending: 3,
  lastError: null,
};

test('truncates error messages to 300 characters', () => {
  assert.equal(truncateErrorMessage(' x '.repeat(200)).length, 300);
});

test('formats a valid stored error without throwing', () => {
  const raw = JSON.stringify({ at: Date.UTC(2026, 10, 1, 12, 0, 0), message: 'Fallo controlado' });
  assert.match(formatLastError(raw), /Fallo controlado/);
  assert.match(formatLastError(raw), /2026-11-01/);
});

test('handles missing or malformed stored errors', () => {
  assert.equal(formatLastError(null), 'Sin error registrado.');
  assert.equal(formatLastError('{malformado'), 'Registro de error no disponible.');
});

test('diagnostic text includes operational fields but no prohibited data', () => {
  const text = buildDiagnosticsText(base);
  assert.match(text, /Versión de la app: 1\.0\.3/);
  assert.match(text, /Base de datos: 2\.0 KB/);
  assert.match(text, /Pendientes del catálogo: 3/);
  assert.doesNotMatch(text, /tienda|cliente|precio|producto/i);
});

test('diagnostic text includes an update id only when present', () => {
  assert.doesNotMatch(buildDiagnosticsText(base), /Actualización:/);
  const withUpdate = buildDiagnosticsText({ ...base, updateId: 'update-1' });
  assert.match(withUpdate, /Actualización: update-1/);
});

test('el diagnóstico dice el canal y si el código viene del APK o de una OTA', () => {
  assert.match(buildDiagnosticsText(base), /Canal de actualizaciones: production\nCódigo en uso: el que trae el APK/);
  assert.match(buildDiagnosticsText({ ...base, launchedFromUpdate: true }), /Código en uso: una actualización OTA/);
  const off = buildDiagnosticsText({ ...base, updateChannel: null, launchedFromUpdate: null });
  assert.match(off, /Canal de actualizaciones: No disponible\nCódigo en uso: No disponible/);
});

test('diagnostic text reports never backed up', () => {
  assert.match(buildDiagnosticsText({ ...base, lastBackupAt: null }), /Nunca/);
});
