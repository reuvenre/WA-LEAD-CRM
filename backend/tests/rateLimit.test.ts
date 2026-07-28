import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimited, resetRateLimits } from '../src/lib/rateLimit';

test('allows up to the cap, then blocks', () => {
  resetRateLimits();
  for (let i = 0; i < 5; i++) assert.equal(rateLimited('ip|1.2.3.4', 5), false, `hit ${i + 1} should pass`);
  assert.equal(rateLimited('ip|1.2.3.4', 5), true, 'the 6th hit is over the cap');
});

test('counters are per key', () => {
  resetRateLimits();
  for (let i = 0; i < 5; i++) rateLimited('a', 5);
  assert.equal(rateLimited('b', 5), false, 'a different caller is unaffected');
});

test('the window slides — old hits stop counting', async () => {
  resetRateLimits();
  const WINDOW = 60;
  for (let i = 0; i < 3; i++) assert.equal(rateLimited('slide', 3, WINDOW), false);
  assert.equal(rateLimited('slide', 3, WINDOW), true);
  await new Promise((r) => setTimeout(r, WINDOW + 20));
  assert.equal(rateLimited('slide', 3, WINDOW), false, 'after the window the caller is clear again');
});
