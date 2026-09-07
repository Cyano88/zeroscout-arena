import assert from 'node:assert/strict'
import test from 'node:test'
import { serializeDirectTradeEvidence } from '../server/src/services/direct-trade-evidence.js'
test('evidence remains complete and valid beyond the old 16000-character cut',()=>{
  const data={news:'x'.repeat(17592),mandate:{maximumSpendUsdc:10},execution:{side:'BUY'},finalSource:'resolution authority'}
  assert.deepEqual(JSON.parse(serializeDirectTradeEvidence(data)),data)
})
test('oversize evidence fails explicitly rather than silently dropping safety fields',()=>{
  assert.throws(()=>serializeDirectTradeEvidence({news:'x'.repeat(48000)}),/exceeds/)
  const data={news:'x'.repeat(47989)}
  assert.equal(serializeDirectTradeEvidence(data).length,48000)
})
