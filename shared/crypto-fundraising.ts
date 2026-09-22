import { z } from 'zod'
const text=z.string().trim().min(1).max(500)
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v},'Use a valid calendar date')
export const fundraisingRequestSchema=z.object({
 schema:z.literal('zeroscout.crypto-fundraising.request'),schemaVersion:z.literal('1.0.0'),
 requestId:z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),query:z.string().trim().min(2).max(200),
 categories:z.array(z.enum(['company-round','public-token-sale','launchpad-raise'])).min(1).max(3).default(['company-round','public-token-sale','launchpad-raise']),
 from:date.default('2009-01-01'),to:date.default(()=>new Date().toISOString().slice(0,10)),limit:z.number().int().min(1).max(20).default(10),
}).strict().superRefine((v,c)=>{if(v.from>v.to)c.addIssue({code:'custom',message:'from must precede to'});if(v.to>new Date().toISOString().slice(0,10))c.addIssue({code:'custom',message:'Historical ranges cannot end in the future'});if(new Set(v.categories).size!==v.categories.length)c.addIssue({code:'custom',message:'Duplicate categories'})})
export type FundraisingRequest=z.infer<typeof fundraisingRequestSchema>
export const factFields=['project','category','round','announcedAt','amountReported','valuationReported','investors','chains','status'] as const
export const fundraisingCandidateSchema=z.object({
 project:text,category:z.enum(['company-round','public-token-sale','launchpad-raise']),round:text.nullable(),
 announcedAt:date.nullable(),amountReported:text.nullable(),valuationReported:text.nullable(),
 investors:z.array(text).max(30),chains:z.array(text).max(20),status:z.enum(['announced','completed','planned','unknown']),
 evidence:z.array(z.object({sourceId:z.string().regex(/^S\d+$/),quote:z.string().min(1).max(1500),fields:z.array(z.enum(factFields)).min(1).max(9)}).strict()).min(1).max(20),
}).strict()
export const fundraisingDraftSchema=z.object({records:z.array(fundraisingCandidateSchema).max(20),dataGaps:z.array(text).max(15)}).strict()
export const fundraisingSourceSchema=z.object({id:z.string(),url:z.string().url(),title:z.string(),publishedAt:z.string().nullable(),retrievedAt:z.string().datetime(),contentSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
export const fundraisingResultSchema=z.object({
 schema:z.literal('zeroscout.crypto-fundraising.result'),schemaVersion:z.literal('1.0.0'),requestId:z.string(),requestCommitment:z.string(),generatedAt:z.string().datetime(),
 provider:z.string(),retrievalProvider:z.literal('Tavily Search'),
 coverage:z.object({mode:z.literal('source-linked-research'),complete:z.literal(false),from:date,to:date,sourceCount:z.number().int(),returned:z.number().int(),discarded:z.number().int(),limit:z.number().int(),totalHistoricalRecords:z.null()}).strict(),
 records:z.array(fundraisingCandidateSchema.extend({id:z.string(),verification:z.literal('ai-extracted-citations-matched')})).max(20),sources:z.array(fundraisingSourceSchema).max(12),
 dataGaps:z.array(z.string()).max(40),disclaimer:z.string(),
}).strict()
