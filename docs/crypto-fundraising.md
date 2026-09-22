# Crypto Fundraising Intelligence (v1)

Dedicated private service `crypto-fundraising`; POST `/api/integrations/crypto-fundraising`.
Other private scopes, including LP + Agreement, cannot call this endpoint. This key cannot call the auditor. Existing key quotas and owner-signature rules are unchanged.

## Data contract
Request schema: `zeroscout.crypto-fundraising.request`, version `1.0.0`.
```json
{"schema":"zeroscout.crypto-fundraising.request","schemaVersion":"1.0.0","requestId":"research_20220901","query":"Uniswap historical funding","from":"2022-01-01","to":"2022-12-31","categories":["company-round","public-token-sale","launchpad-raise"],"limit":10}
```
Response schema: `zeroscout.crypto-fundraising.result`, version `1.0.0`.
Full executable definitions: `shared/crypto-fundraising.ts`.
Records include project, category, round, announcement date, amount/valuation as reported, investors, chains, status and field-level source quotes. Each source records URL, retrieval timestamp and content hash. Records have stable content-derived IDs. Exact duplicates are removed; different reported amounts are not silently merged. Unknown values are null or empty arrays; unknown event dates are excluded by the date filter. Article publication dates are not automatically event dates. Planned raises are excluded. No totals or currency conversions are computed.

`coverage.complete` is always false. `totalHistoricalRecords` is null. Empty results do not prove no fundraising occurred. This is search-backed historical research, NOT a licensed comprehensive historical database. Search queries include the requested period; the result filter enforces event dates extracted from source text. Date interpretation and classification are AI-derived, not independently verified. Disagreements and missing evidence remain data gaps. A future curated provider can supplement research without changing the service-key boundary.

## Providers and operation
Reuses configured `ZEROSCOUT_GENERAL_SEARCH_API_KEY` / `ZEROSCOUT_GENERAL_SEARCH_BASE_URL` (Tavily) and 0G Compute credentials. Two bounded search queries, up to ten source excerpts, then one structured extraction. `ZEROSCOUT_FUNDRAISING_MODEL` defaults to `gpt-5.6-sol`; changing it does not change the auditor model. No automatic retry or trust-mode fallback. Total route deadline 125 seconds; retrieval 25 seconds/query; extraction 90 seconds. Provider errors are sanitized. Matching a quotation only proves text presence, not truth.
Requests are governed by the existing private-key daily/minute/concurrent limits; existing middleware counts accepted private requests, including downstream failures. These are per-integration-key limits, NOT per Grail user. No new user quotas were added. No query or result database is introduced.

## Create the credential
Open `https://zeroscout.app/private-keys?service=crypto-fundraising` with the designated owner wallet. Prefills Grail, grail-fundraising-research, Crypto Fundraising Intelligence. Current dashboard defaults: 100 requests/day, 5/minute, 2 concurrent, 30-day expiry (existing shared private-service limits still apply). Review and sign the existing key-management message. No blockchain transaction.
Keep the returned one-time key in the consuming backend as `ZEROSCOUT_FUNDRAISING_API_KEY`. Send it as `Authorization: Bearer ...` to ZeroScout. Never put it in a NEXT_PUBLIC/VITE variable, browser bundle, query string or repository. No key is minted by this code deployment; creation requires the existing owner signature.
