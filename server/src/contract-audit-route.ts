import {auditFailureCode} from './services/audit-diagnostics.js'
import type { Request, Response } from 'express'
import { contractAuditRequestSchema } from '../../shared/contract-audit.js'
import { privateIdentity } from './private-access.js'
import { generateContractAudit } from './services/smart-contract-audit.js'

export function contractAuditHandler(generate = generateContractAudit, identity = privateIdentity) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control','private, no-store')
    if (!identity(req)) { res.status(401).json({error:'A dedicated Smart Contract Auditing private key is required.'}); return }
    const parsed = contractAuditRequestSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({error:'Invalid smart-contract audit request. Check schema, unique source files, size and sharing consent.'}); return }
    const abort = new AbortController()
    const timer = setTimeout(()=>abort.abort(),75000)
    const disconnect = () => { if (!res.writableEnded) abort.abort() }
    res.once('close',disconnect)
    try { const result = await generate(parsed.data, undefined, abort.signal); if (!abort.signal.aborted) res.json(result); else if (!res.destroyed) res.status(504).json({error:'Contract review timed out. No completed report was produced.'}) }
    catch(error) { if (!res.destroyed) { const code=auditFailureCode(error,abort.signal);res.status(abort.signal.aborted?504:503).json({error:'Contract review could not complete. No security verdict was produced.',code}) } }
    finally { clearTimeout(timer);res.removeListener('close',disconnect) }
  }
}
