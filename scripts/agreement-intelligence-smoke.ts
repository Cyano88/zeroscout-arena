import assert from 'node:assert/strict'
import { agreementIntelligenceRequestSchema } from '../server/src/validation.js'
import { generateAgreementIntelligence } from '../server/src/services/agreement-intelligence.js'
import { createHash } from 'node:crypto'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}'
  }
  return JSON.stringify(value)
}

const terms = {
  template: 'fixed_unlock',
  title: 'Verified research delivery',
  deliveryDescription: 'Deliver a cited research brief with source links and a concise executive summary.',
  amountUsdcUnits: '100250000',
  durationSeconds: 86400,
  cancellationWindowSeconds: 900,
  releasePercentages: [100],
}

const input = agreementIntelligenceRequestSchema.parse({
  schema: 'zeroscout.agreement-intelligence.request',
  schemaVersion: '1.0.0',
  requestId: 'uai_1234567890abcdef',
  issuedAt: '2026-08-19T12:00:00.000Z',
  source: {
    product: 'hashpaystream',
    environment: 'testnet',
    providerReference: 'hps_provider_' + 'a'.repeat(32),
  },
  agreement: {
    state: 'draft',
    ...terms,
    termsHash: 'sha256:' + createHash('sha256').update(canonical(terms)).digest('hex'),
  },
  advance: {
    requestedBps: 3000,
    requestedUsdcUnits: '30075000',
    fundingNetwork: 'x-layer-testnet',
    fundingAsset: 'test-usdc',
    providerPayoutAddress: '0x1111111111111111111111111111111111111111',
  },
  settlement: {
    protectionNetwork: 'arc-testnet',
    protectionAsset: 'test-usdc',
    recipientSelection: 'fixed-repayment-router',
    assetBridgeRequired: false,
  },
  evidence: {
    providerHistoryIncluded: false,
    sources: ['hashpaystream-agreement-draft'],
    dataGaps: ['provider-history', 'payer-funding-confirmation', 'delivery-history'],
  },
})

const result = await generateAgreementIntelligence(input, async () => {
  throw new Error('AI unavailable in deterministic smoke test')
})
assert.equal(result.schema, 'zeroscout.agreement-intelligence.result')
assert.equal(result.schemaVersion, '1.0.0')
assert.equal(result.recommendation, 'proceed')
assert.equal(result.evidenceGrade, 'limited')
assert.equal(result.recommendedMaxAdvanceBps, 3000)
assert.equal(result.intelligenceProvider, 'zeroscout-deterministic-evidence-engine')
assert.match(result.requestCommitment, /^sha256:[a-f0-9]{64}$/)
assert(result.reasonCodes.includes('NO_PROVIDER_HISTORY'))
assert(!JSON.stringify(result).includes(input.agreement.deliveryDescription))

const fundedInput = agreementIntelligenceRequestSchema.parse({
  ...input,
  agreement: { ...input.agreement, state: 'funded', protectionDeadline: 1_787_227_200 },
  evidence: {
    providerHistoryIncluded: false,
    sources: ['hashpaystream-authoritative-agreement', 'arc-funded-agreement'],
    dataGaps: ['provider-history', 'delivery-history'],
  },
})
const fundedResult = await generateAgreementIntelligence(fundedInput, async () => { throw new Error('AI unavailable') })
assert.equal(fundedResult.recommendation, 'proceed')
assert.equal(fundedResult.confidence, 61)
assert.equal(fundedResult.recommendedMaxAdvanceBps, 3500)
assert.equal(fundedInput.agreement.protectionDeadline, 1_787_227_200)
assert.equal(agreementIntelligenceRequestSchema.safeParse({ ...input, agreement: { ...input.agreement, state: 'funded' } }).success, false)

const inconsistent = {
  ...input,
  advance: { ...input.advance, requestedUsdcUnits: '30075001' },
}
assert.equal(agreementIntelligenceRequestSchema.safeParse(inconsistent).success, false)
assert.equal(agreementIntelligenceRequestSchema.safeParse({
  ...input,
  agreement: { ...input.agreement, title: 'Tampered title' },
}).success, false)

console.log('ZeroScout Agreement Intelligence smoke checks passed.')
