import test from 'node:test'
import assert from 'node:assert/strict'
import { isComputeBalanceRejection } from '../server/src/services/compute-balance-error.js'
test('recognizes structured and wrapped upstream balance errors',()=>{
  for(const error of [{code:'insufficient_balance'},{error:{code:'BALANCE_INSUFFICIENT'}},new Error('configured trust failed: 503; default trust failed: 403 BALANCE_INSUFFICIENT')]) assert(isComputeBalanceRejection(error))
})
test('does not stop fallback for ordinary provider or evidence failures',()=>{
  for(const error of [null,{},new Error('503 provider unavailable'),new Error('timed out'),new Error('insufficient evidence'),new Error('empty content')]) assert.equal(isComputeBalanceRejection(error),false)
})
