import assert from 'node:assert/strict'

process.env.ZG_COMPUTE_API_KEY = 'test-0g-key'
process.env.ZG_COMPUTE_BASE_URL = 'https://router-api.0g.test/v1'
process.env.ZEROSCOUT_FULL_PLATFORM_MODEL = 'generic-model-must-not-enter-direct-trade-routing'
process.env.ZEROSCOUT_DIRECT_TRADE_MODEL = 'direct-trade-test-model'
process.env.ZEROSCOUT_DIRECT_TRADE_MODEL_CANDIDATES = 'direct-trade-test-model'
process.env.ZEROSCOUT_DIRECT_TRADE_MODEL_DISCOVERY = 'false'
process.env.ZEROSCOUT_DIRECT_TRADE_MODEL_LIMIT = '2'
process.env.ZEROSCOUT_HELPER_MODEL = 'direct-trade-fallback-model'
process.env.ZG_COMPUTE_TRUST_MODE = 'verified'
process.env.ZEROSCOUT_DIRECT_TRADE_ATTEMPT_TIMEOUT_MS = '3000'
process.env.ZEROSCOUT_DIRECT_TRADE_TRUST_PROBE_TIMEOUT_MS = '1000'

const originalFetch = globalThis.fetch
const prompts: string[] = []
const responseFormats: unknown[] = []
const outputTokenLimits: unknown[] = []
const reasoningEfforts: unknown[] = []
const trustModes: Array<string | null> = []
let mockedAssessmentSide: 'BUY' | 'SELL' = 'BUY'
let mockTrustFailure = true
let mockHang = false
let mockConfiguredTrustHang = false
let mockConfiguredTrustInvalid = false
let mockPrimaryModelFailure = false

globalThis.fetch = async (_url, init = {}) => {
  const headers = new Headers(init.headers)
  const trustMode = headers.get('x-0g-provider-trust-mode')
  trustModes.push(trustMode)
  if (mockHang || (mockConfiguredTrustHang && trustMode)) {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init.signal
      if (signal?.aborted) return reject(new DOMException('The operation was aborted.', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true })
    })
  }
  const body = JSON.parse(String(init.body ?? '{}')) as { model?: string; response_format?: unknown; max_tokens?: unknown; reasoning_effort?: unknown; messages?: Array<{ content?: string }> }
  if (mockPrimaryModelFailure && body.model === 'direct-trade-test-model') {
    return new Response(JSON.stringify({ error: { message: 'Primary model unavailable' } }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }
  prompts.push((body.messages ?? []).map(message => message.content ?? '').join('\n'))
  responseFormats.push(body.response_format)
  outputTokenLimits.push(body.max_tokens)
  reasoningEfforts.push(body.reasoning_effort)
  if (trustMode && mockConfiguredTrustInvalid) {
    return new Response(JSON.stringify({
      id: '0g-direct-trade-invalid',
      choices: [{ message: { role: 'assistant', content: 'incomplete non-JSON output' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (trustMode) {
    return new Response(JSON.stringify({ error: { message: mockTrustFailure ? 'No provider available for the requested trust mode' : 'Request timed out' } }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }
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
  const { classifyCustomIntelligenceLane, directTradeModelCandidates, generateCustomIntelligence, getDirectTradeModelReadiness } = await import('../server/src/services/ai.js')
  assert.deepEqual(directTradeModelCandidates(), ['direct-trade-test-model'])
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
  assert.equal(getDirectTradeModelReadiness().state, 'available')
  assert.match(getDirectTradeModelReadiness().model ?? '', /direct-trade-test-model/i)
  assert.equal(result.intent, 'polymarket-direct-trade-intelligence')
  assert.equal(result.tradeAssessment?.stance, 'SUPPORT')
  assert.equal(result.tradeAssessment?.side, 'BUY')
  assert.match(result.riskFlags?.[0] ?? '', /Resolution and headline risk remain/)
  assert.notEqual(result.riskFlags?.[0], '[object Object]')
  mockPrimaryModelFailure = true
  const modelFallbackResult = await generateCustomIntelligence(directInput)
  assert.match(modelFallbackResult.aiProvider, /direct-trade-fallback-model/i)
  assert.equal(modelFallbackResult.tradeAssessment?.stance, 'SUPPORT')
  mockPrimaryModelFailure = false
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
  assert.match(prompts.join('\n'), /Return exactly one JSON object with this shape/i)
  assert(responseFormats.every(value => value === undefined))
  assert(outputTokenLimits.every(value => value === 1200))
  assert(reasoningEfforts.every(value => value === 'low'))
  assert(trustModes.includes('verified'))
  assert(trustModes.includes(null))
  mockTrustFailure = false
  const callsBeforeTimeout = trustModes.length
  const errorFallbackResult = await generateCustomIntelligence(directInput)
  assert.equal(errorFallbackResult.tradeAssessment?.stance, 'INSUFFICIENT')
  assert.deepEqual(trustModes.slice(callsBeforeTimeout), ['verified', null])
  mockConfiguredTrustInvalid = true
  const callsBeforeInvalidFallback = trustModes.length
  const invalidFallbackResult = await generateCustomIntelligence(directInput)
  assert.equal(invalidFallbackResult.tradeAssessment?.stance, 'INSUFFICIENT')
  assert.deepEqual(trustModes.slice(callsBeforeInvalidFallback), ['verified', null])
  mockConfiguredTrustInvalid = false
  mockConfiguredTrustHang = true
  const callsBeforeFallback = trustModes.length
  const fallbackResult = await generateCustomIntelligence(directInput)
  assert.equal(fallbackResult.tradeAssessment?.stance, 'INSUFFICIENT')
  assert.deepEqual(trustModes.slice(callsBeforeFallback), ['verified', null])
  mockConfiguredTrustHang = false
  mockHang = true
  const callsBeforeHang = trustModes.length
  const degradedResult = await generateCustomIntelligence(directInput)
  assert.equal(degradedResult.tradeAssessment?.stance, 'INSUFFICIENT')
  assert.equal(degradedResult.tradeAssessment?.evidenceQuality, 'LOW')
  assert.equal(degradedResult.proofMetadata?.degraded, true)
  assert.equal(degradedResult.proofMetadata?.failureClass, 'all-direct-trade-models-unavailable')
  assert.equal(getDirectTradeModelReadiness().state, 'unavailable')
  assert.match(degradedResult.disclaimer, /does not authorize PolyDesk PREPARE/i)
  assert.equal(trustModes.length, callsBeforeHang + 4)
  console.log('zeroscout direct-trade intelligence smoke ok')
} finally {
  globalThis.fetch = originalFetch
}
