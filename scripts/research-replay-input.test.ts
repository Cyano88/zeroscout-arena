import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { verifiedResearchReplayInput } from '../server/src/services/research-replay-input.js'

const input = { partner: 'polydesk', productType: 'polymarket-direct-trading', analysisType: 'polydesk-smart-market-research', proofClass: 'polydesk_smart_market_research', data: { observedAt: 'old-timestamp', side: 'BUY' } }
const json = JSON.stringify({ id: 'test', artifactType: 'zeroscout.custom-intelligence', input })
const hash = (s: string) => `0x${createHash('sha256').update(s).digest('hex')}`
test('verified archive preserves original evidence and timestamps', () => {
  assert.deepEqual(verifiedResearchReplayInput(json, hash(json), 'test'), input)
})
test('tampered content, wrong report, and wrong lane fail before inference', () => {
  assert.throws(() => verifiedResearchReplayInput(json + ' ', hash(json), 'test'), /hash mismatch/)
  assert.throws(() => verifiedResearchReplayInput(json, hash(json), 'different'), /expected PolyDesk/)
  const wrong = json.replace('polymarket-direct-trading', 'other')
  assert.throws(() => verifiedResearchReplayInput(wrong, hash(wrong), 'test'), /expected PolyDesk/)
})
