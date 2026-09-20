# Smart Contract Auditing for Grail

Service ID: `smart-contract-auditing`
Endpoint: `POST /api/integrations/smart-contract-audit`
Key setup: `/dashboard?service=smart-contract-auditing`

Dedicated private key only. LP, Agreement and existing `all-private` keys do not gain auditing access. The combined existing scope is now labelled LP + Agreement. No existing key is rotated, revoked or changed. Existing integration limits remain unchanged; these are separate from future Grail per-user audit quotas.

## Request
```json
{
  "schema": "zeroscout.smart-contract-audit.request",
  "schemaVersion": "1.0.0",
  "requestId": "grail_audit_001",
  "sources": [{"path":"Example.sol","content":"pragma solidity ^0.8.20; contract Example {}"}],
  "context": "Describe intended behavior, trusted roles and deployment assumptions.",
  "sourceSharingConsent": true
}
```
Send the key as a server-side Bearer credential. Never put it in a NEXT_PUBLIC variable or a client request. Grail must verify the user's account and enforce its own confirmed user quotas before forwarding a request. Request IDs are correlation IDs, not an idempotency guarantee; never retry paid calls automatically.

Limits on source size and output size protect processing: at most 20 files, 40,000 characters per file, 60 KB total request, 100 mapped functions and 12 candidate issues. No partial silent source truncation. The server never fetches imports, executes code, or archives source/reports to 0G Storage. The submitted source is sent to the configured 0G inference provider; explicit sharing consent is required. Provider privacy depends on the existing configured trust mode, with no automatic trust downgrade.

## Compute and report
Reuses ZeroScout's `ZG_COMPUTE_API_KEY`, base URL and trust mode. Optional `ZEROSCOUT_CONTRACT_AUDIT_MODEL` overrides the configured full-platform model. Two sequential model passes (second only when valid candidates exist): source review, then a separate challenge pass. No claim that the same model's second pass is an independent human or model consensus.

Strict validated `zeroscout.smart-contract-audit.result` v1.0.0 contains source hashes, request commitment, source-cited access map, unverified leads, AI-rejected possible false positives, invalid-evidence rejections, adjudication status and limitations. Exact file/line/quote matching is enforced. Matching source is not proof of exploitability. No findings are automatically confirmed. A failed first pass returns an error; a failed challenge pass preserves unverified leads and declares degraded coverage.

Methodology adapts Pashov's open-source skills at revision c577eb7799c349de0acb187ba00ca98e14e436fd: https://github.com/pashov/skills (MIT license alongside this guide). This is not the full 12-agent Pashov skill execution and not a Pashov audit or endorsement. Narrowing casts truncate in Solidity; nonReentrant does not establish universal safety; agent agreement is not proof. Tests, fuzzing, compilation, runtime paths and bytecode matching require a separate execution environment.

## Validation
`npm run typecheck`
`node --import tsx --test scripts/smart-contract-audit.test.ts scripts/private-services.test.ts scripts/private-access.test.ts`
`npm run build`

Tests use deterministic model fixtures, not paid inference. Live Grail-to-ZeroScout inference requires creating and securely configuring the dedicated key.
