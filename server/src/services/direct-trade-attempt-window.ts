// Reserve a useful fallback without dividing the deadline among the whole
// discovered catalog. Scale the reserve down for short configured deadlines.
export function directTradeAttemptWindow(remainingMs: number, attemptCapMs: number, reserveFallback = false): number {
  if (!Number.isFinite(remainingMs) || !Number.isFinite(attemptCapMs)) return 0
  const fallbackMs = Math.min(10_000, Math.floor(remainingMs / 2), Math.max(0, attemptCapMs))
  const availableMs = reserveFallback ? remainingMs - fallbackMs : remainingMs
  return Math.max(0, Math.min(availableMs, attemptCapMs))
}
