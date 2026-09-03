import assert from 'node:assert/strict'

process.env.ZG_COMPUTE_API_KEY = 'test-0g-key'
process.env.ZG_COMPUTE_BASE_URL = 'https://router-api.0g.test/v1'
process.env.ZEROSCOUT_FULL_PLATFORM_MODEL = 'direct-trade-test-model'
process.env.ZEROSCOUT_DIRECT_TRADE_MODEL = 'direct-trade-test-model'
process.env.ZEROSCOUT_DIRECT_TRADE_MODEL_CANDIDATES = 'direct-trade-test-model'

const originalFetch = globalThis.fetch
const prompts: string[] = []
let mockedAssessmentSide: 'BUY' | 'SELL' = 'BUY'

globalThis.fetch = async (_url, init = {}) => {
  const body = JSON.parse(String(init.body ?? '{}')) as { model?: string; messages?: Array<{ content?: string }> }
  prompts.push((body.messages ?? []).map(message => message.content ?? '').join('\n'))
  return new Response(JSON.stringify({
    id: '0g-direct-trade-test',
    object: 'chat.completion',
    created: 1,
    model: body.model,
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          intelligenceScore: 76,
          confidence: 63,
          summary: 'The supplied evidence supports the requested BUY, subject to the stated risks.',
          signals: ['Current two-sided book is inside the supplied mandate.'],
          riskFlags: [{ risk: 'Resolution and headline risk remain.', severity: 'high' }],
          recommendedActions: ['Refresh the order book before preparing the trade.'],
          dataGaps: [],
          suggestedVisuals: [],
          disclaimer: 'Decision support only.',
          suggestedAnswer: 'Market: test. PolyDesk view: cautious support. Decision: SUPPORT.',
          reasoningSummary: 'Only supplied evidence was used.',
          safetyBoundaries: ['Preview and typed confirmation remain mandatory.'],
          tradeAssessment: {
            stance: 'SUPPORT',
            side: mockedAssessmentSide,
            thesis: 'The supplied evidence supports the requested side.',
            counterThesis: 'New contrary evidence could reverse the view.',
            resolutionRisk: 'Official resolution rules remain authoritative.',
            evidenceQuality: 'MEDIUM',
          },
        }),
      },
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

try {
  const { classifyCustomIntelligenceLane, generateCustomIntelligence } = await import('../server/src/services/ai.js')
  const directInput = {
    partner: 'polydesk',
    productType: 'polymarket-direct-trading',
    analysisType: 'polydesk-smart-market-research',
    objective: 'Assess one exact direct trade.',
    outputStyle: 'evidence brief',
    data: {
      proofClass: 'polydesk_smart_market_research',
      observedAt: '2026-09-01T10:00:00.000Z',
      side: 'BUY',
      market: { conditionId: `0x${'12'.repeat(32)}`, title: 'Test market' },
      outcome: { tokenId: '123456789', label: 'Yes' },
      execution: { bestBid: 0.49, bestAsk: 0.51, spread: 0.02, bookAgeSeconds: 1 },
      mandate: { maximumPrice: 0.6, maximumPriceDrift: 0.05, maximumSpendUsdc: 10 },
      smartMoney: { status: 'not-observed' },
      sportsNews: [],
    },
  }
  assert.equal(classifyCustomIntelligenceLane(directInput), 'direct-trade')
  assert.equal(classifyCustomIntelligenceLane({ ...directInput, productType: 'lp-scout', analysisType: 'lp-market-intelligence', data: { proofClass: 'paid_lp_scout_proof' } }), 'lp-intelligence')
  const conflictingInput = { ...directInput, analysisType: 'lp-market-intelligence' }
  assert.equal(classifyCustomIntelligenceLane(conflictingInput), 'conflict')
  await assert.rejects(() => generateCustomIntelligence(conflictingInput), /mixes direct-trade and LP routing markers/i)
  const result = await generateCustomIntelligence(directInput)
  assert.equal(result.intent, 'polymarket-direct-trade-intelligence')
  assert.equal(result.tradeAssessment?.stance, 'SUPPORT')
  assert.equal(result.tradeAssessment?.side, 'BUY')
  assert.match(result.riskFlags?.[0] ?? '', /Resolution and headline risk remain/)
  assert.notEqual(result.riskFlags?.[0], '[object Object]')
  mockedAssessmentSide = 'SELL'
  const mismatchedResult = await generateCustomIntelligence(directInput)
  assert.equal(mismatchedResult.tradeAssessment?.side, 'SELL')
  assert.equal(mismatchedResult.tradeAssessment?.stance, 'INSUFFICIENT')
  assert.equal(mismatchedResult.tradeAssessment?.evidenceQuality, 'LOW')
  const topLevelProofConflict = {
    ...directInput,
    productType: 'custom-platform',
    analysisType: 'lp-market-intelligence',
    proofClass: 'polydesk_smart_market_research',
    data: { ...directInput.data, proofClass: undefined },
  }
  assert.equal(classifyCustomIntelligenceLane(topLevelProofConflict), 'conflict')
  assert.match(prompts.join('\n'), /never LP analysis/i)
  assert.match(prompts.join('\n'), /Never recommend supplying liquidity/i)
  assert.match(prompts.join('\n'), /downstream execution gates/i)
  assert.match(prompts.join('\n'), /must not be reported as a research data gap/i)
  assert.match(prompts.join('\n'), /RESOLUTION_AUTHORITY/i)
  console.log('zeroscout direct-trade intelligence smoke ok')
} finally {
  globalThis.fetch = originalFetch
}
