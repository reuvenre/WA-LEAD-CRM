import test from 'node:test';
import assert from 'node:assert/strict';
import { newKeyMaterial, hashKey } from '../src/lib/apiKeys';

test('a key carries enough entropy to be unguessable', () => {
  const { key } = newKeyMaterial();
  assert.ok(key.startsWith('relc_'), 'prefixed so a leaked key is recognisable in logs');
  // 32 random bytes → 43 base64url chars. Anything shorter means the CSPRNG call changed.
  assert.equal(key.length - 'relc_'.length, 43);
  assert.match(key, /^relc_[A-Za-z0-9_-]+$/, 'URL-safe: it travels in headers and config fields');
});

test('keys are unique across mints', () => {
  const keys = new Set(Array.from({ length: 500 }, () => newKeyMaterial().key));
  assert.equal(keys.size, 500);
});

test('the plaintext key is never derivable from what we store', () => {
  const { key, keyHash, prefix } = newKeyMaterial();
  assert.ok(!keyHash.includes(key.slice(5)), 'the stored digest must not contain the secret');
  assert.equal(keyHash.length, 64, 'sha256 hex');
  // The prefix is shown in the UI, so it must reveal only a token amount of the key.
  assert.equal(prefix.length, 12);
  assert.ok(key.startsWith(prefix));
});

test('hashing is deterministic — the same key always authenticates', () => {
  const { key, keyHash } = newKeyMaterial();
  assert.equal(hashKey(key), keyHash);
  assert.notEqual(hashKey(key + 'x'), keyHash);
  // A near-miss must not collide: authentication is an exact lookup on this digest.
  assert.notEqual(hashKey(key.slice(0, -1)), keyHash);
});
