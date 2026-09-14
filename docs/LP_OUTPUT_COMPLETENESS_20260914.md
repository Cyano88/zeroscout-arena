# LP output completeness repair

Status: local implementation; no deployment or live inference performed.

The single receipt-linked correction on September 14 failed after one model returned truncated JSON and other models timed out. The retained error does not include that response's stop reason or token usage, so token-limit exhaustion is a plausible cause, not proven telemetry.

## Changes

- LP primary output limit is 4096 tokens on both Messages and chat-completions. LP verifier output is capped at 2048. Normal Messages callers keep 2400 and normal chat callers retain their existing options.
- LP prompt requests compact JSON, short fields and bounded arrays, without repeating source rows or payment metadata. Supplied evidence is preserved.
- LP Messages stop_reason=max_tokens and chat finish_reason=length are rejected, even if the visible text parses. These errors do not trigger a same-model format/trust retry; remaining configured models remain subject to the existing total deadline.
- LP parsing requires a complete, nonempty JSON object. It never salvages a valid prefix from an incomplete response or fabricates missing closing braces. Empty text, empty objects, arrays and malformed JSON fail closed.
- Shared 90-second LP compute budget and 30-second maximum attempt budget remain unchanged. Payment and receipt handling are untouched.

## Verification

Mocked output tests cover both transport truncation flags, output budgets, no same-model replay after output exhaustion, malformed/partial/empty output rejection. Existing LP compatibility tests verify primary/verifier budgets and unchanged normal Messages parameters. All four timeout tests and the server build passed. General-research and direct-trade intelligence regression smokes both passed. Whitespace checks passed.

## Limits

This is an offline-tested mitigation, not proof that a live model will now return complete JSON within 30 seconds. A larger token ceiling does not enlarge the time budget. The existing 32,000-character evidence guard still rejects oversized evidence before inference. No new payment or correction attempt was made.

Next: deploy the LP output repair, then run one explicitly authorized correction under the original receipt after checking existing results.
