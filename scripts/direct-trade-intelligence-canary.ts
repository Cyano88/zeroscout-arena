import assert from 'node:assert/strict'
import { generateCustomIntelligence } from '../server/src/services/ai.js'

assert(process.env.ZG_COMPUTE_API_KEY, 'ZG_COMPUTE_API_KEY is required for the direct-trade canary.')

const observedAt = new Date().toISOString()
const newsEvidence = Array.from({ length: 8 }, (_, index) => ({
  title: `Canary evidence source ${index + 1}`,
  description: `Synthetic production-size evidence fixture ${index + 1}. ${'This text is untrusted evidence data used only to exercise routing, token budgets, cancellation, and JSON validation. '.repeat(10)}`,
  source: 'canary.invalid',
  url: `https://canary.invalid/evidence/${index + 1}`,
  publishedAt: observedAt,
  retrievedAt: observedAt,
  evidenceRole: 'EXTERNAL_SOURCE',
}))

const startedAt = Date.now()
const result = await generateCustomIntelligence({
  partner: 'polydesk-canary',
  productType: 'polymarket-direct-trading',
  analysisType: 'polydesk-smart-market-research',
  proofClass: 'polydesk_smart_market_research',
  objective: 'Exercise the production direct-trade route with synthetic evidence. Do not infer real-world facts.',
  outputStyle: 'Concise evidence brief.',
  data: {
    proofClass: 'polydesk_smart_market_research',
    observedAt,
    side: 'BUY',
    mandate: { maximumPrice: 0.6, maximumPriceDrift: 0.03, maximumSpendUsdc: 5 },
    market: {
      conditionId: `0x${'12'.repeat(32)}`,
      title: 'Synthetic production canary market',
      description: 'This market is synthetic and must not be treated as real.',
    },
    outcome: { tokenId: '123456789', label: 'Yes' },
    execution: { bestBid: 0.48, bestAsk: 0.49, spread: 0.01, bookAgeSeconds: 2 },
    smartMoney: { status: 'not-observed' },
    newsEvidence,
  },
})

assert(result.tradeAssessment, 'Direct-trade canary returned no trade assessment.')
console.log(JSON.stringify({
  ok: true,
  elapsedMs: Date.now() - startedAt,
  provider: result.aiProvider,
  stance: result.tradeAssessment.stance,
  evidenceQuality: result.tradeAssessment.evidenceQuality,
}))
