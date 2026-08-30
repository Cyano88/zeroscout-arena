import { z } from "zod";
import { createHash } from 'node:crypto'
import { campaignTypes, rounds, stages } from "../../shared/types.js";

export const capsuleInputSchema = z.object({
  projectName: z.string().min(2).max(90),
  teamName: z.string().min(2).max(90),
  tagline: z.string().min(4).max(140),
  repoUrl: z.string().url(),
  demoUrl: z.string().url(),
  videoDemoUrl: z.string().url().refine(isSupportedVideoUrl, "Video walkthrough URL must be a YouTube or Loom link.").optional(),
  creatorWallet: z.string().optional(),
  round: z.enum(rounds),
  description: z.string().min(20).max(4000),
  ogUsageClaims: z.string().min(20).max(3000),
  pitchNotes: z.string().max(3000).optional(),
  stage: z.enum(stages),
  previousCapsuleId: z.string().optional(),
  campaignId: z.string().min(2).max(100).optional(),
  campaignName: z.string().min(2).max(120).optional(),
  campaignType: z.enum(campaignTypes).optional(),
  checkpointLabel: z.string().min(2).max(120).optional(),
  checkpointNumber: z.number().int().min(0).max(1000).optional(),
  builderWallet: z.string().max(120).optional(),
  builderEmail: z.string().email().optional(),
  mentorFocus: z.string().max(2000).optional(),
  helpNeeded: z.string().max(240).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  source: z.enum(["hosted", "deeplink", "embed", "api"]).optional(),
  externalUserId: z.string().max(160).optional(),
  externalOrgId: z.string().max(160).optional()
});

export const matchupInputSchema = z.object({
  capsuleAId: z.string().min(3),
  capsuleBId: z.string().min(3)
});

function isSupportedVideoUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtube.com" || host === "youtu.be" || host === "loom.com";
  } catch {
    return false;
  }
}

const usdcUnitsSchema = z.string().regex(/^[1-9]\d{0,18}$/)
const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/).refine(value => !/^0x0{40}$/i.test(value), 'Address cannot be zero.')

export const agreementIntelligenceRequestSchema = z.object({
  schema: z.literal('zeroscout.agreement-intelligence.request'),
  schemaVersion: z.enum(['1.0.0', '2.0.0']),
  requestId: z.string().regex(/^uai_[a-zA-Z0-9]{12,80}$/),
  issuedAt: z.string().datetime({ offset: true }),
  source: z.object({
    product: z.literal('hashpaystream'),
    environment: z.enum(['testnet', 'hybrid']),
    providerReference: z.string().regex(/^hps_provider_[a-f0-9]{32}$/),
  }).strict(),
  agreement: z.object({
    state: z.enum(['draft', 'funded']),
    template: z.literal('fixed_unlock'),
    title: z.string().trim().min(3).max(140),
    deliveryDescription: z.string().trim().min(10).max(800),
    amountUsdcUnits: usdcUnitsSchema,
    durationSeconds: z.number().int().min(3_600).max(2_592_000),
    cancellationWindowSeconds: z.number().int().min(0).max(86_400),
    releasePercentages: z.tuple([z.literal(100)]),
    termsHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    protectionDeadline: z.number().int().safe().positive().optional(),
  }).strict(),
  advance: z.object({
    requestedBps: z.number().int().min(1_000).max(8_000),
    requestedUsdcUnits: usdcUnitsSchema,
    fundingNetwork: z.enum(['x-layer-testnet', 'x-layer-mainnet']),
    fundingAsset: z.enum(['test-usdc', 'usdc']),
    providerPayoutAddress: evmAddressSchema,
  }).strict(),
  settlement: z.object({
    protectionNetwork: z.literal('arc-testnet'),
    protectionAsset: z.literal('test-usdc'),
    recipientSelection: z.literal('fixed-repayment-router'),
    providerRecipient: evmAddressSchema,
    assetBridgeRequired: z.literal(false),
  }).strict(),
  evidence: z.object({
    providerHistoryIncluded: z.boolean(),
    sources: z.array(z.string().trim().min(3).max(100)).min(1).max(20),
    dataGaps: z.array(z.string().trim().min(3).max(100)).max(20),
  }).strict(),
}).strict().superRefine((value, context) => {
  const validNetworkProfile = value.schemaVersion === '1.0.0'
    ? value.source.environment === 'testnet'
      && value.advance.fundingNetwork === 'x-layer-testnet'
      && value.advance.fundingAsset === 'test-usdc'
    : value.source.environment === 'hybrid'
      && value.advance.fundingNetwork === 'x-layer-mainnet'
      && value.advance.fundingAsset === 'usdc'
  if (!validNetworkProfile) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['schemaVersion'], message: 'Schema version does not match the declared funding environment.' })
  }
  if (value.agreement.cancellationWindowSeconds >= value.agreement.durationSeconds) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['agreement', 'cancellationWindowSeconds'], message: 'Cancellation window must end before agreement expiry.' })
  }
  if (value.agreement.state === 'funded' && value.agreement.protectionDeadline === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['agreement', 'protectionDeadline'], message: 'Funded agreements require the authoritative Arc expiry.' })
  }
  const amount = BigInt(value.agreement.amountUsdcUnits)
  const expectedAdvance = amount * BigInt(value.advance.requestedBps) / 10_000n
  if (BigInt(value.advance.requestedUsdcUnits) !== expectedAdvance) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['advance', 'requestedUsdcUnits'], message: 'Requested advance does not match the agreement amount and basis points.' })
  }
  const terms = {
    template: value.agreement.template,
    title: value.agreement.title,
    deliveryDescription: value.agreement.deliveryDescription,
    amountUsdcUnits: value.agreement.amountUsdcUnits,
    durationSeconds: value.agreement.durationSeconds,
    cancellationWindowSeconds: value.agreement.cancellationWindowSeconds,
    releasePercentages: value.agreement.releasePercentages,
  }
  const expectedTermsHash = 'sha256:' + createHash('sha256').update(canonicalAgreementIntelligence(terms)).digest('hex')
  if (value.agreement.termsHash !== expectedTermsHash) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['agreement', 'termsHash'], message: 'Terms hash does not match the supplied agreement terms.' })
  }
})

export type AgreementIntelligenceRequest = z.infer<typeof agreementIntelligenceRequestSchema>

function canonicalAgreementIntelligence(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalAgreementIntelligence).join(',') + ']'
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonicalAgreementIntelligence(record[key])).join(',') + '}'
  }
  return JSON.stringify(value)
}
