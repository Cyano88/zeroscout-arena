// Never cut serialized evidence mid-field or silently drop later safety inputs.
export function serializeDirectTradeEvidence(data: Record<string, unknown>): string {
  const serialized = JSON.stringify(data)
  if (serialized.length > 48_000) throw new Error('Direct-trade evidence exceeds the 48000-character limit; summarize evidence before research. No inference was started.')
  return serialized
}
