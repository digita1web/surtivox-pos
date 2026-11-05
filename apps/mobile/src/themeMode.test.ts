import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNight, resolveScheme, statusBarToneFor, parseAppearance, parseHour, formatHour, scheduleSummary, oppositeMode,
  DEFAULT_APPEARANCE, DEFAULT_SCHEDULE, FROM_OPTIONS, UNTIL_OPTIONS, APPEARANCE_OPTIONS,
} from './themeMode.ts';

const at = (hour: number, minute = 0) => new Date(2026, 10, 5, hour, minute);

test('the night window crosses midnight: 7 p. m. to 6 a. m.', () => {
  const night = [19, 20, 23, 0, 1, 5];
  const day = [6, 7, 12, 17, 18];
  for (const h of night) assert.equal(isNight(at(h), DEFAULT_SCHEDULE), true, `${h}:00`);
  for (const h of day) assert.equal(isNight(at(h), DEFAULT_SCHEDULE), false, `${h}:00`);
});

test('the boundaries are exact to the minute', () => {
  assert.equal(isNight(at(18, 59), DEFAULT_SCHEDULE), false);
  assert.equal(isNight(at(19, 0), DEFAULT_SCHEDULE), true);
  assert.equal(isNight(at(5, 59), DEFAULT_SCHEDULE), true);
  assert.equal(isNight(at(6, 0), DEFAULT_SCHEDULE), false);
});

test('a window inside the same day and an empty window both work', () => {
  assert.equal(isNight(at(13), { from: 12, until: 15 }), true);
  assert.equal(isNight(at(15), { from: 12, until: 15 }), false);
  assert.equal(isNight(at(3), { from: 12, until: 15 }), false);
  assert.equal(isNight(at(3), { from: 6, until: 6 }), false);
});

test('every selectable start and end gives a night shorter than a day and never always on or off', () => {
  for (const from of FROM_OPTIONS) for (const until of UNTIL_OPTIONS) {
    let nightHours = 0;
    for (let h = 0; h < 24; h++) if (isNight(at(h), { from, until })) nightHours++;
    assert.ok(nightHours > 0 && nightHours < 24, `${from}-${until}: ${nightHours}`);
  }
});

test('each mode resolves to the right scheme', () => {
  const s = DEFAULT_SCHEDULE;
  assert.equal(resolveScheme('light', 'dark', at(23), s), 'light');
  assert.equal(resolveScheme('dark', 'light', at(12), s), 'dark');
  assert.equal(resolveScheme('system', 'dark', at(12), s), 'dark');
  assert.equal(resolveScheme('system', 'light', at(23), s), 'light');
  assert.equal(resolveScheme('system', null, at(23), s), 'light');
  assert.equal(resolveScheme('auto', 'light', at(23), s), 'dark');
  assert.equal(resolveScheme('auto', 'dark', at(12), s), 'light');
});

test('status bar icons are dark on a light screen and light on a dark one', () => {
  assert.equal(statusBarToneFor('light'), 'dark');
  assert.equal(statusBarToneFor('dark'), 'light');
});

test('stored values are validated and damaged ones fall back to the defaults', () => {
  assert.equal(DEFAULT_APPEARANCE, 'light');
  for (const mode of ['light', 'dark', 'system', 'auto'] as const) assert.equal(parseAppearance(mode), mode);
  for (const raw of [null, undefined, '', 'Dark', 'night', '1']) assert.equal(parseAppearance(raw), 'light');
  assert.equal(parseHour('20', FROM_OPTIONS, 19), 20);
  for (const raw of [null, '', 'x', '3', '19.5', '25', '-1']) assert.equal(parseHour(raw, FROM_OPTIONS, 19), 19, String(raw));
});

test('hours and the schedule are written the way a shopkeeper reads them', () => {
  assert.equal(formatHour(19), '7:00 p. m.');
  assert.equal(formatHour(6), '6:00 a. m.');
  assert.equal(formatHour(0), '12:00 a. m.');
  assert.equal(formatHour(12), '12:00 p. m.');
  assert.equal(scheduleSummary(DEFAULT_SCHEDULE), 'Oscuro de 7:00 p. m. a 6:00 a. m.');
});

test('the quick button always switches to the opposite scheme and the options are complete', () => {
  assert.equal(oppositeMode('light'), 'dark');
  assert.equal(oppositeMode('dark'), 'light');
  assert.deepEqual(APPEARANCE_OPTIONS.map((o) => o.key), ['light', 'dark', 'auto', 'system']);
  for (const option of APPEARANCE_OPTIONS) assert.ok(option.label && option.hint);
});
