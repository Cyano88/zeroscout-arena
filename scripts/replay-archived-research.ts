import { loadCanonicalArtifact } from '../server/src/services/storage.js'
import { generateCustomIntelligence, diagnoseDirectTradeTokenBudget } from '../server/src/services/ai.js'
import { verifiedResearchReplayInput } from '../server/src/services/research-replay-input.js'

// This diagnostic is pinned to recovery attempt 2. No public endpoint, payment,
// credit deduction, artifact upload, saved decision, or trade is invoked.
const args = process.argv.slice(2).join(' ')
const expandedBudget = args === '--execute-research-only --expanded-budget'
if (args !== '--execute-research-only' && !expandedBudget) {
  throw new Error('Pass --execute-research-only to authorize one compute-only diagnostic.')
}
const root = '0xa53947d21ceda295666d4e27543fc03beaad38da002f9ca6fabad0e94a4f542a'
const hash = '0xddb826f14d7f8b56f1e5ca44a58220464b287d8241e0af07e653454d47e41f32'
const watchdog = setTimeout(() => { console.error('Diagnostic time limit exceeded; do not retry blindly.'); process.exit(1) }, 120_000)
try {
  const archive = await loadCanonicalArtifact(root)
  const input = verifiedResearchReplayInput(archive.canonicalJson, hash, '7vxuxS4oQd')
  console.log(JSON.stringify({ diagnosticOnly: true, archivedEvidence: true, hashVerified: true, inputCharacters: JSON.stringify(input.data).length }))
  const started = Date.now()
  console.log(JSON.stringify({ diagnosticOnly: true, expandedBudget, ...(expandedBudget ? { model: 'gpt-5.6-terra', maxTokens: 4000, totalTimeoutMs: 60000 } : {}) }))
  const result = expandedBudget ? await diagnoseDirectTradeTokenBudget(input) : await generateCustomIntelligence(input)
  const degraded = result.proofMetadata?.degraded === true
  console.log(JSON.stringify({ diagnosticOnly: true, archivedEvidence: true, ok: !degraded,
    elapsedMs: Date.now() - started, provider: result.aiProvider,
    stance: result.tradeAssessment?.stance ?? null, evidenceQuality: result.tradeAssessment?.evidenceQuality ?? null,
    storageUpload: false, paidRecovery: false, tradeAuthorized: false }))
  if (degraded) process.exitCode = 1
} finally { clearTimeout(watchdog) }
