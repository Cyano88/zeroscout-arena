import { createHash } from 'node:crypto'
import type { AgreementIntelligenceRequest } from '../validation.js'
import { generateCustomIntelligence } from './ai.js'

export const AGREEMENT_INTELLIGENCE_RESULT_SCHEMA = 'zeroscout.agreement-intelligence.result' as const
export const AGREEMENT_INTELLIGENCE_RESULT_VERSION = '1.0.0' as const

export type AgreementIntelligenceResult = {
  schema: typeof AGREEMENT_INTELLIGENCE_RESULT_SCHEMA
  schemaVersion: typeof AGREEMENT_INTELLIGENCE_RESULT_VERSION
  requestCommitment: string
  intelligenceProvider: string
  recommendation: 'proceed' | 'review' | 'needs_evidence'
  confidence: number
  evidenceGrade: 'standard' | 'limited' | 'insufficient'
  deliveryClarityScore: number
  recommendedMaxAdvanceBps: number
  summary: string
  signals: string[]
  riskFlags: string[]
  dataGaps: string[]
  reasonCodes: string[]
  disclaimer: string
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}'
  }
  return JSON.stringify(value)
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)))
}

function unique(values: string[], maximum = 20) {
  return [...new Set(values.map(value => value.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, maximum)
}

async function withOptionalAiDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Optional agreement AI timed out.')), timeoutMs)
  })
  try { return await Promise.race([promise, timeout]) }
  finally { if (timer) clearTimeout(timer) }
}

function deterministicEvidence(input: AgreementIntelligenceRequest) {
  const words = input.agreement.deliveryDescription.split(/\s+/).filter(Boolean).length
  const deliveryClarityScore = clamp(
    42
      + Math.min(28, words * 2)
      + (input.agreement.title.length >= 12 ? 8 : 0)
      + (input.agreement.durationSeconds >= 86_400 ? 7 : 0)
      - (input.agreement.cancellationWindowSeconds > input.agreement.durationSeconds / 4 ? 12 : 0),
    0,
    100,
  )
  const dataGaps = unique(input.evidence.dataGaps)
  const riskFlags = [
    ...(!input.evidence.providerHistoryIncluded ? ['Provider delivery history is not included.'] : []),
    ...(input.agreement.durationSeconds < 86_400 ? ['The delivery window is shorter than one day.'] : []),
    ...(input.agreement.cancellationWindowSeconds > input.agreement.durationSeconds / 4 ? ['The cancellation window consumes more than 25% of the delivery period.'] : []),
    ...(input.advance.requestedBps > 5_000 ? ['The requested advance exceeds 50% of the protected payment.'] : []),
  ]
  const evidenceGrade = dataGaps.length >= 4
    ? 'insufficient' as const
    : dataGaps.length > 0 || !input.evidence.providerHistoryIncluded
      ? 'limited' as const
      : 'standard' as const
  const recommendedMaxAdvanceBps = clamp(
    5_000
      - dataGaps.length * 500
      - (!input.evidence.providerHistoryIncluded ? 500 : 0)
      - (deliveryClarityScore < 70 ? 1_000 : 0),
    1_000,
    6_000,
  )
  const recommendation = evidenceGrade === 'insufficient'
    ? 'needs_evidence' as const
    : input.advance.requestedBps <= recommendedMaxAdvanceBps && deliveryClarityScore >= 70
      ? 'proceed' as const
      : 'review' as const
  const confidence = clamp(85 - dataGaps.length * 8 - (!input.evidence.providerHistoryIncluded ? 8 : 0), 20, 90)
  return { deliveryClarityScore, dataGaps, riskFlags, evidenceGrade, recommendedMaxAdvanceBps, recommendation, confidence }
}

export async function generateAgreementIntelligence(
  input: AgreementIntelligenceRequest,
  generate: typeof generateCustomIntelligence = generateCustomIntelligence,
  aiTimeoutMs = 8_000,
): Promise<AgreementIntelligenceResult> {
  const deterministic = deterministicEvidence(input)
  let aiProvider = 'zeroscout-deterministic-evidence-engine'
  let aiSummary = ''
  let aiSignals: string[] = []
  let aiRiskFlags: string[] = []
  try {
    const ai = await withOptionalAiDeadline(generate({
      partner: 'HashPayStream',
      productType: 'agreement-financing',
      analysisType: 'agreement-intelligence',
      objective: 'Assess evidence quality, delivery clarity, and bounded advance risk without making a lending decision.',
      outputStyle: 'structured-underwriting-evidence',
      data: input,
    }), Math.max(1, Math.min(15_000, Math.floor(aiTimeoutMs))))
    aiProvider = ai.aiProvider
    aiSummary = ai.summary
    aiSignals = ai.signals
    aiRiskFlags = ai.riskFlags
  } catch {
    // The deterministic evidence contract remains available when an AI provider is unavailable.
  }

  const reasonCodes = unique([
    deterministic.evidenceGrade === 'limited' ? 'LIMITED_EVIDENCE' : '',
    deterministic.evidenceGrade === 'insufficient' ? 'INSUFFICIENT_EVIDENCE' : '',
    !input.evidence.providerHistoryIncluded ? 'NO_PROVIDER_HISTORY' : '',
    input.advance.requestedBps > deterministic.recommendedMaxAdvanceBps ? 'ADVANCE_ABOVE_EVIDENCE_CAP' : '',
    deterministic.deliveryClarityScore < 70 ? 'DELIVERY_TERMS_NEED_CLARITY' : '',
  ])
  const fallbackSummary = deterministic.recommendation === 'proceed'
    ? 'The supplied agreement evidence can proceed to a separate policy decision.'
    : deterministic.recommendation === 'review'
      ? 'The agreement needs policy review because the requested advance is not fully supported by the available evidence.'
      : 'More agreement evidence is required before this request should reach a funding policy.'

  return {
    schema: AGREEMENT_INTELLIGENCE_RESULT_SCHEMA,
    schemaVersion: AGREEMENT_INTELLIGENCE_RESULT_VERSION,
    requestCommitment: 'sha256:' + createHash('sha256').update(canonical(input)).digest('hex'),
    intelligenceProvider: aiProvider,
    recommendation: deterministic.recommendation,
    confidence: deterministic.confidence,
    evidenceGrade: deterministic.evidenceGrade,
    deliveryClarityScore: deterministic.deliveryClarityScore,
    recommendedMaxAdvanceBps: deterministic.recommendedMaxAdvanceBps,
    summary: aiSummary || fallbackSummary,
    signals: unique(aiSignals),
    riskFlags: unique([...deterministic.riskFlags, ...aiRiskFlags]),
    dataGaps: deterministic.dataGaps,
    reasonCodes,
    disclaimer: 'ZeroScout Agreement Intelligence is evidence and decision support only. It does not approve funding, guarantee repayment, or provide financial or legal advice.',
  }
}
