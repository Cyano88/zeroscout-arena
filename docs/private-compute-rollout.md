# Private compute rollout (not activated)

Designated owner: `0xa2Ae0A3B3eD7B30AB049685a934de587a0F51d66`.
The address is user-designated; key issuance requires its valid signature.

`ZEROSCOUT_PRIVATE_MODE=true` enables a default-deny perimeter. PostgreSQL is
required. Existing dashboard/admin routes, legacy secrets, public compute and
storage routes, and credit-purchase routes are blocked. Existing records are
preserved; only separately issued `zs_private_` keys are accepted.

Signed management paths are GET/POST `/api/private/keys` and POST
`/api/private/keys/:id/revoke`. Sign the exact `ownerActionMessage` using the owner
wallet; send `x-zs-nonce` (32 random bytes in hex), `x-zs-expires` (Unix milliseconds,
at most five minutes ahead), and `x-zs-signature`. Nonces are single-use in PostgreSQL.
Never paste the wallet private key or generated API key into chat/logs.

Initial maximums per key: 100 requests/day UTC, 5/minute UTC, 2 concurrent,
30-day expiry. Owner may request stricter limits. Ten active keys maximum.
Shared limits: 500 requests/day and 4 concurrent. Every admitted request counts,
including readiness and unsuccessful downstream requests. Disconnects retain a
lease until its ten-minute expiry. Finished responses release it.

Quotas use a dedicated transactional store and one advisory lock. They do not
depend on the old credit counters. Private integration requests bypass credit
deductions, but underlying inference, research, and proof storage can still cost.
Request quotas are not token/currency ceilings; existing model caps still apply.

Before activation:
1. PostgreSQL concurrency/replay/revocation tests passed in a disposable PostgreSQL 16 container; repeat after policy changes.
2. Open `/private-keys` with the designated owner wallet extension. The interface signs list, create, and revoke actions; it never persists generated keys in browser storage. Live owner signing remains to be verified.
3. Inventory PolyDesk's current credential without printing it. Schedule cutover:
   private mode rejects all old credentials immediately, so do not flip it first.
   Enable `ZEROSCOUT_PRIVATE_KEYS_STAGING=true` while leaving private mode off.
   Staging allows signed private management and quota-controlled private-key calls,
   but does NOT close legacy/public access yet.
4. Create an owner-signed private key and securely configure PolyDesk.
5. Verify allowed research calls, denied non-owner/legacy calls, and quota exhaustion.
6. Verify top-up routes are inaccessible and remove old purchase UI references.

Private mode permits static GET routes so the owner page and assets remain accessible;
API routes remain default-deny. Both dashboard URLs support the configured Privy
login (including its connected EVM wallets), with injected-wallet fallback when
Privy is disabled. Only the designated owner wallet can authorize management.
Login alone does not authorize a key action. Do not paste API keys or signatures into chat.

This is an implementation checkpoint, not a production-readiness claim.

## Per-key service selection

New keys require an explicit `service`: `lp-intelligence` (intelligence, readiness,
general research), `agreement-intelligence` (agreement endpoint only), or
`all-private` (both). Unknown or omitted selections fail closed. The signed body
also includes a platform label. Permissions are endpoint-level, not analysis-type
filters or trade approvals. Helper sponsorship, video, and passports remain denied.
An additive database migration preserves existing private keys with `all-private`,
matching their previous access. No keys are revoked by creation or migration.
Legacy keys remain a separate store and are rejected only upon full-mode cutover.
