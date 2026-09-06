import { createHash } from 'node:crypto'
import type { CustomIntelligenceInput } from './ai.js'

export function verifiedResearchReplayInput(json: string, expectedHash: string, expectedId: string): CustomIntelligenceInput {
  if (!/^0x[0-9a-f]{64}$/i.test(expectedHash) || `0x${createHash('sha256').update(json).digest('hex')}` !== expectedHash.toLowerCase()) {
    throw new Error('Archived research content hash mismatch; no inference was started.')
  }
  const artifact = JSON.parse(json)
  const input = artifact?.input
  if (artifact?.id !== expectedId || artifact?.artifactType !== 'zeroscout.custom-intelligence'
    || input?.partner !== 'polydesk' || input?.productType !== 'polymarket-direct-trading'
    || input?.analysisType !== 'polydesk-smart-market-research'
    || input?.proofClass !== 'polydesk_smart_market_research'
    || !input?.data || typeof input.data !== 'object' || Array.isArray(input.data)) {
    throw new Error('Archived artifact is not the expected PolyDesk direct-trade research input.')
  }
  return input
}
