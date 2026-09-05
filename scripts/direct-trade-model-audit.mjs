// Synthetic probes only. Never log credentials or provider response bodies.
const baseUrl = String(process.env.ZG_COMPUTE_BASE_URL || '').replace(/\/$/, '')
const apiKey = String(process.env.ZG_COMPUTE_API_KEY || '')
if (!baseUrl || !apiKey) throw new Error('0G Compute configuration is unavailable')
const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }
const catalogResponse = await fetch(`${baseUrl}/models`, { headers, signal: AbortSignal.timeout(10000) })
if (!catalogResponse.ok) throw new Error(`Catalog returned HTTP ${catalogResponse.status}`)
const catalog = await catalogResponse.json()
const available = new Set((Array.isArray(catalog) ? catalog : catalog.data || []).map(row => row.id))
const models = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'glm-5.3', 'qwen3.7-plus'].filter(model => available.has(model))
const results = await Promise.all(models.map(async model => {
  const startedAt = Date.now()
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ model, temperature: 0, max_tokens: 128, reasoning_effort: 'low',
        messages: [{ role: 'user', content: 'Return only this JSON object: {"ok":true,"route":"ready"}' }] }),
    })
    const body = await response.json().catch(() => ({}))
    const content = body?.choices?.[0]?.message?.content
    let usable = false
    try { const parsed = JSON.parse(content); usable = parsed.ok === true && parsed.route === 'ready' } catch {}
    return { model, status: response.status, durationMs: Date.now() - startedAt, usable,
      contentLength: typeof content === 'string' ? content.length : 0,
      finishReason: body?.choices?.[0]?.finish_reason ?? null,
      errorCode: typeof body?.error?.code === 'string' ? body.error.code : null }
  } catch (error) {
    return { model, status: 0, durationMs: Date.now() - startedAt, usable: false, errorType: error.name }
  }
}))
console.log(JSON.stringify({ observedAt: new Date().toISOString(), results }, null, 2))
