import test from 'node:test'
import assert from 'node:assert/strict'
import { directTradeAttemptWindow } from '../server/src/services/direct-trade-attempt-window.js'

test('first inference retains thirty seconds instead of half the total deadline', () => {
  assert.equal(directTradeAttemptWindow(40_000, 30_000), 30_000)
})
test('later attempts cannot overrun the remaining deadline', () => {
  assert.equal(directTradeAttemptWindow(9_700, 30_000), 9_700)
  assert.equal(directTradeAttemptWindow(39_500, 30_000), 30_000)
  assert.equal(directTradeAttemptWindow(-1, 30_000), 0)
})

test('oversized first-attempt configuration cannot starve the fallback', () => {
  assert.equal(directTradeAttemptWindow(40_000, 60_000, true), 20_000)
  assert.equal(directTradeAttemptWindow(19_800, 60_000), 19_800)
  assert.equal(directTradeAttemptWindow(40_000, 3_000, true), 3_000)
  assert.equal(directTradeAttemptWindow(40_000, 60_000), 40_000)
  assert.equal(directTradeAttemptWindow(Number.NaN, 60_000, true), 0)
})
