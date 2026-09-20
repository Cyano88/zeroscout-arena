# Smart contract review benchmark

## Purpose and scope
Four original synthetic contracts form two matched pairs. Only source, a neutral filename and neutral context are sent to ZeroScout. Expected answers stay local. This is a small diagnostic set, not a general security accuracy claim or independent certification.

A1: anyone can set the treasury, then distribute the contract balance to that address. Attacker needs an existing funded balance; owner interaction is unnecessary.
A2: identical contract except setTreasury requires msg.sender == owner. Anyone may trigger distribution, but the destination is owner-controlled. Owner powers alone are not an external theft finding.
B1: withdrawal uses tx.origin. An owner EOA must call an attacker intermediary which calls withdraw with the attacker recipient. This required owner interaction must be disclosed.
B2: identical withdrawal uses msg.sender. The forwarding contract fails the owner check. An owner-directed withdrawal is intended authority.

These expectations cover those specific attack paths only. Control fixtures are not certified free of all possible issues. There are no imports or upgrade paths. Compiler checks verify valid Solidity, not exploitation; EVM exploit and regression execution has not yet been added.

## Reproduce

Compile without model calls:

    node scripts/audit-benchmark.mjs

Live service benchmark (four calls; no automatic retries):

    node --env-file=C:/Users/USER/the-beaks/.env.local scripts/audit-benchmark.mjs --live

On this Windows machine the existing Grail network adapter is needed:

    $env:AUDIT_BENCHMARK_TRANSPORT='C:/Users/USER/the-beaks/app/lib/grailServerFetch.mjs'

The transport is an explicitly selected trusted local module. Credentials are loaded from the environment and never included in artifacts. Output contains only synthetic source, hashes, compiler metadata and reports. Expected outcomes never enter prompts. The benchmark uses the dedicated service key; it does not debit a Grail user's allowance.

Artifacts: output/audit-benchmark/<timestamp>/results.json plus each exact source file. Service errors are recorded separately and never counted as safe or true negatives. Failed cases make the command exit nonzero. Pin compiler/dependency versions with the repository lockfile when comparing runs.

## First live baseline: 2026-09-20

Run: 2026-09-20T18-02-05-783Z
Service revision: 247c1a3 (whole-response JSON fence fix)
Compiler reported: 0.8.36+commit.8a079791.Emscripten.clang
Optimizer disabled; EVM target Shanghai. All four fixtures compiled.

| Case | Expected path | HTTP | Duration | Outcome |
| --- | --- | --- | --- | --- |
| A1 | Exposed treasury setter | 503 | 14.6 s | Service failure |
| A2 | Owner-protected treasury setter | 504 | 77.1 s | Timeout |
| B1 | tx.origin forwarding attack | 503 | 51.8 s | Service failure |
| B2 | msg.sender blocks forwarding | 504 | 76.8 s | Timeout |

Completed reports: 0/4. Operational completion rate on this single tiny run: 0%. Detection recall, precision and false-positive rate: NOT MEASURABLE, because no usable reports returned. Two vulnerable cases were unassessed; neither counts as a semantic miss or a successful detection. Two controls were unassessed; neither counts as a false positive or a clean result.

An earlier direct-fetch attempt failed locally before reaching the service and is retained separately as run 2026-09-20T18-00-35-892Z. It is excluded from the service baseline.

## Review rubric once reports complete
A vulnerable-case detection must describe the target entry point, attacker control, all guards and prerequisites, and loss of another party's assets with matching source citations. A keyword mention alone is insufficient. An unrelated observation does not count as detection. Any remaining lead on a control needs human adjudication; do not automatically call it false just because the fixture is a control. AI-rejected candidates and surviving false positives must be counted separately.

## Next engineering work
Instrument per-stage duration and sanitized failure codes (provider, JSON syntax, schema, decision coverage, timeout) without logging source, raw provider output or secrets. The current endpoint collapses multiple causes into 503; their causes are not yet verified. Replace the fragile single synchronous request with a durable background job before extending deadlines blindly. Preserve per-account reservation/refund and idempotent recovery. Then rerun this unchanged baseline before tuning prompts, add EVM exploit/control tests, and expand the corpus with held-out cases and repeated runs.

Production audit logic and user-facing security claims were not changed by this benchmark.

## Follow-up diagnostics: 2026-09-20
Live replay of A1 returned stop_reason=refusal, with only 311 output characters. The prior SyntaxError was downstream of a provider-declined completion, not a missing brace we should repair. A2 spent its entire 75-second deadline in the first pass. No challenge pass ran on that attempt.

The service now classifies provider refusal explicitly and rejects even complete-looking text when the provider marks it refused. Audit-only diagnostics emit allowlisted stage, duration, status and error codes; source, raw output, exception messages and credentials are excluded. Grail distinguishes refusal from timeout and busy responses. Failed reviews continue to release reservations.

13 focused audit tests and 85 Grail tests passed. These fixes improve failure handling and diagnosis; they do not establish improved benchmark completion. Durable background processing and a provider-supported completion path remain outstanding. Do not describe this benchmark as passed.
