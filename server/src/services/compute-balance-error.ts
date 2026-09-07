// Machine error codes only; do not interpret research prose as account state.
export function isComputeBalanceRejection(error: unknown): boolean {
  const value = error as { code?:unknown; message?:unknown; error?:{code?:unknown} } | null
  const code = String(value?.code ?? value?.error?.code ?? '')
  const message = typeof value?.message === 'string' ? value.message : ''
  return /^(BALANCE_INSUFFICIENT|INSUFFICIENT_BALANCE)$/i.test(code)
    || /\b(BALANCE_INSUFFICIENT|INSUFFICIENT_BALANCE)\b/i.test(message)
}
