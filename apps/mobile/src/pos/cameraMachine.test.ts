import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialCameraState,
  reduceCamera,
  type CameraMachineState,
} from './cameraMachine.ts';

function focusedReady(): CameraMachineState {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  return reduceCamera(state, { type: 'ready' });
}

test('starts when focused, active and permitted', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  assert.equal(state.phase, 'idle');
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  assert.equal(state.phase, 'starting');
  assert.equal(state.attempt, 1);
  state = reduceCamera(state, { type: 'ready' });
  assert.equal(state.phase, 'ready');
  assert.equal(state.retries, 0);
});

test('mount alone does not start the camera', () => {
  const state = reduceCamera(initialCameraState(true), { type: 'mount' });
  assert.equal(state.phase, 'idle');
});

test('times out once and retries once', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  state = reduceCamera(state, { type: 'timeout' });
  assert.equal(state.phase, 'retrying');
  assert.equal(state.retries, 1);
  assert.equal(state.attempt, 2);
});

test('times out twice and then fails', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  state = reduceCamera(state, { type: 'timeout' });
  state = reduceCamera(state, { type: 'timeout' });
  assert.equal(state.phase, 'retrying');
  assert.equal(state.retries, 2);
  assert.equal(state.attempt, 3);
  state = reduceCamera(state, { type: 'timeout' });
  assert.equal(state.phase, 'failed');
  assert.equal(state.retries, 2);
  assert.equal(state.attempt, 3);
});

test('manual retry resets retries and remounts', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  state = reduceCamera(state, { type: 'timeout' });
  state = reduceCamera(state, { type: 'timeout' });
  state = reduceCamera(state, { type: 'timeout' });
  assert.equal(state.phase, 'failed');
  state = reduceCamera(state, { type: 'retry' });
  assert.equal(state.phase, 'starting');
  assert.equal(state.retries, 0);
  assert.equal(state.attempt, 4);
});

test('blur and background release the camera and focus restarts it', () => {
  let state = focusedReady();
  state = reduceCamera(state, { type: 'blur' });
  assert.equal(state.phase, 'idle');
  assert.equal(state.focused, false);
  state = reduceCamera(state, { type: 'focus' });
  assert.equal(state.phase, 'starting');
  state = reduceCamera(state, { type: 'ready' });
  state = reduceCamera(state, { type: 'appBackground' });
  assert.equal(state.phase, 'idle');
  assert.equal(state.appActive, false);
  state = reduceCamera(state, { type: 'appActive' });
  assert.equal(state.phase, 'starting');
});

test('active app does not start while the screen is unfocused', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  assert.equal(state.phase, 'idle');
  state = reduceCamera(state, { type: 'appActive' });
  assert.equal(state.phase, 'idle');
  state = reduceCamera(state, { type: 'focus' });
  assert.equal(state.phase, 'starting');
});

test('denied permission stays denied until granted', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'denied' });
  assert.equal(state.phase, 'denied');
  state = reduceCamera(state, { type: 'focus' });
  assert.equal(state.phase, 'denied');
  state = reduceCamera(state, { type: 'retry' });
  assert.equal(state.phase, 'denied');
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  assert.equal(state.phase, 'starting');
});

test('blocked permission stays blocked until settings grant it', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'blocked' });
  assert.equal(state.phase, 'blocked');
  state = reduceCamera(state, { type: 'retry' });
  assert.equal(state.phase, 'blocked');
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  assert.equal(state.phase, 'starting');
});

test('an error while ready remounts the camera', () => {
  const state = reduceCamera(focusedReady(), { type: 'error' });
  assert.equal(state.phase, 'retrying');
  assert.equal(state.retries, 1);
  assert.equal(state.attempt, 2);
});

test('permission unknown returns to idle and clears retries', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  state = reduceCamera(state, { type: 'timeout' });
  state = reduceCamera(state, { type: 'permission', value: 'unknown' });
  assert.equal(state.phase, 'idle');
  assert.equal(state.retries, 0);
});

test('ready is ignored after the machine has failed', () => {
  let state = initialCameraState(true);
  state = reduceCamera(state, { type: 'focus' });
  state = reduceCamera(state, { type: 'permission', value: 'granted' });
  state = reduceCamera(state, { type: 'timeout' });
  state = reduceCamera(state, { type: 'timeout' });
  state = reduceCamera(state, { type: 'timeout' });
  const failed = reduceCamera(state, { type: 'ready' });
  assert.equal(failed.phase, 'failed');
});
