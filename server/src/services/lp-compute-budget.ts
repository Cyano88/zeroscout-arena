// LP-only limits shared by primary analysis, transport fallbacks and verifier.
export const LP_COMPUTE_BUDGET_MS = 90_000;
export const LP_ATTEMPT_BUDGET_MS = 30_000;
export class LpComputeBudget {
  private readonly deadline: number;
  constructor(private readonly totalMs = LP_COMPUTE_BUDGET_MS, private readonly attemptMs = LP_ATTEMPT_BUDGET_MS) {
    this.deadline = Date.now() + totalMs;
  }
  async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const remaining = this.deadline - Date.now();
    if (remaining <= 0) throw new Error(`LP compute budget exhausted after ${this.totalMs}ms.`);
    const windowMs = Math.min(this.attemptMs, remaining);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`LP compute attempt timed out after ${windowMs}ms.`));
        }, windowMs);
      });
      const result = await Promise.race([operation(controller.signal), timeout]);
      if (Date.now() >= this.deadline || controller.signal.aborted) {
        throw new Error(`LP compute budget exhausted after ${this.totalMs}ms.`);
      }
      return result;
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
    }
  }
}
