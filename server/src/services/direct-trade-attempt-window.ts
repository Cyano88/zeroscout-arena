// Reserve one viable fallback on the first attempt; later attempts may use the
// remainder. Do not divide the budget among every discovered catalog model.
export function directTradeAttemptWindow(remainingMs: number, attemptCapMs: number, reserveFallback = false): number {
  if (!Number.isFinite(remainingMs) || !Number.isFinite(attemptCapMs)) return 0
  const availableMs = reserveFallback ? Math.floor(remainingMs / 2) : remainingMs
  return Math.max(0, Math.min(availableMs, attemptCapMs))
}
