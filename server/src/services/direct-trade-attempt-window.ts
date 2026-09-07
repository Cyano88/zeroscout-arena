// Give an inference its configured allowance, bounded by the request deadline.
// A full inference is not a short provider-health probe.
export function directTradeAttemptWindow(remainingMs: number, attemptCapMs: number): number {
  return Math.max(0, Math.min(remainingMs, attemptCapMs))
}
