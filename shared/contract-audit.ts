import { z } from 'zod'

const text = z.string().trim().min(1).max(2000)
export const contractAuditRequestSchema = z.object({
  schema: z.literal('zeroscout.smart-contract-audit.request'),
  schemaVersion: z.literal('1.0.0'),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  sources: z.array(z.object({
    path: z.string().regex(/^[A-Za-z0-9_./@-]{1,160}\.sol$/).refine(p => !p.split('/').includes('..') && !p.startsWith('/'), 'Use a relative Solidity filename'),
    content: z.string().min(1).max(40000),
  }).strict()).min(1).max(20),
  context: z.string().max(4000).default(''),
  sourceSharingConsent: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.sources.map(s => s.path)).size !== value.sources.length) ctx.addIssue({code:'custom', message:'Duplicate source filenames'})
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 60000) ctx.addIssue({code:'custom', message:'Audit request exceeds 60 KB'})
})
export type ContractAuditRequest = z.infer<typeof contractAuditRequestSchema>
export const auditEvidenceSchema = z.object({
  file: z.string().min(1).max(170), lineStart: z.number().int().positive(), lineEnd: z.number().int().positive(), quote: z.string().min(1).max(2000),
}).strict()
const evidence = z.array(auditEvidenceSchema).min(1).max(12)
export const auditCandidateSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), title: text,
  severity: z.enum(['high','medium','low','informational']),
  actor: text, entryPoint: text, attackPath: z.array(text).min(1).max(12),
  permissions: text, guards: z.array(text).max(12), controllableState: z.array(text).max(12),
  preconditions: z.array(text).max(12), impact: text,
  evidence, falsePositiveChecks: z.array(text).min(1).max(12),
  missingProof: z.array(text).min(1).max(12), recommendedTest: text,
}).strict()
export const auditDraftSchema = z.object({
  summary: text,
  accessMap: z.array(z.object({
    contract: text, function: text, visibility: z.enum(['external','public','internal','private','unknown']),
    callers: text, modifiers: z.array(text).max(12), stateChanges: z.array(text).max(20),
    externalPath: z.array(text).max(12), evidence, uncertainties: z.array(text).max(12),
  }).strict()).max(100),
  candidates: z.array(auditCandidateSchema).max(12),
  limitations: z.array(text).min(1).max(20),
}).strict()
export const auditJudgementSchema = z.object({
  decisions: z.array(z.object({
    id: z.string().max(40), decision: z.enum(['retain','reject','uncertain']),
    reason: text, evidence: z.array(auditEvidenceSchema).max(12),
  }).strict()).max(12),
}).strict()
