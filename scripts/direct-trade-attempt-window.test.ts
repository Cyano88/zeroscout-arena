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

test('oversized attempt configuration preserves a useful final fallback', () => {
  assert.equal(directTradeAttemptWindow(40_000, 60_000, true), 30_000)
  assert.equal(directTradeAttemptWindow(19_800, 60_000), 19_800)
  assert.equal(directTradeAttemptWindow(40_000, 3_000, true), 3_000)
  assert.equal(directTradeAttemptWindow(40_000, 60_000), 40_000)
  assert.equal(directTradeAttemptWindow(Number.NaN, 60_000, true), 0)
})

test('two slow models leave a full third-model window inside the original deadline', () => {
  let remaining = 40_000
  const allocations: number[] = []
  for (let index = 0; index < 3; index++) {
    const budget = directTradeAttemptWindow(remaining, 20_000, index < 2)
    allocations.push(budget)
    remaining -= budget + (index < 2 ? 2 : 0) // scheduler overhead between attempts
  }
  assert.deepEqual(allocations, [20_000, 9_999, 9_997])
  assert.equal(remaining, 0)
})

test('fast failures and a short remaining window do not fragment useful inference time', () => {
  assert.equal(directTradeAttemptWindow(39_000, 20_000, true), 20_000)
  assert.equal(directTradeAttemptWindow(10_000, 20_000, true), 5_000)
  assert.equal(directTradeAttemptWindow(2_000, 20_000), 2_000)
  assert.equal(directTradeAttemptWindow(40_000, -1, true), 0)
  assert.equal(directTradeAttemptWindow(Infinity, 20_000, true), 0)
})
