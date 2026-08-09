import test from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion } from '../scripts/bump.mjs';

test('plain patch bump', () => {
  assert.equal(nextVersion('1.1.1'), '1.1.2');
  assert.equal(nextVersion('0.1.0'), '0.1.1');
});

test('patch 9 carries into minor', () => {
  assert.equal(nextVersion('1.1.9'), '1.2.0');
  assert.equal(nextVersion('0.0.9'), '0.1.0');
});

test('minor 9 carries into major', () => {
  assert.equal(nextVersion('1.9.9'), '2.0.0');
  assert.equal(nextVersion('9.9.9'), '10.0.0');
});

test('major may exceed one digit', () => {
  assert.equal(nextVersion('10.0.0'), '10.0.1');
  assert.equal(nextVersion('12.9.9'), '13.0.0');
});

test('rejects malformed or out-of-range versions', () => {
  assert.throws(() => nextVersion('1.1'));
  assert.throws(() => nextVersion('1.1.10'));
  assert.throws(() => nextVersion('1.a.1'));
});
