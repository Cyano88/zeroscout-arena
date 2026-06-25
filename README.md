# ZeroScout

ZeroScout is a plug-and-play proof layer for builder programs.

It turns a builder's repo, demo, and checkpoint notes into an AI-reviewed Project Passport stored on 0G. Hackathons, universities, grant programs, accelerators, demo days, and ecosystem teams can use it to collect real progress proof without building their own review system.

Zero Cup is the launch campaign. Grail Builders University is the first real-world cohort template.

## Fast Links

- [10-minute integration guide](./10_MINUTE_INTEGRATION.md): add Project Passports or video scoring to an existing platform.
- [Demo script](./DEMO_SCRIPT.md): the clean recording flow for judges, builders, and partners.
- [Deployment guide](./DEPLOYMENT.md): Railway, Vercel, 0G mainnet, Postgres, and env setup.

## What It Does

- Builders create public Project Passports.
- AI generates a scout brief, readiness signal, risks, next steps, and share copy.
- 0G stores the canonical proof capsule.
- Organizations start with a hosted builder link.
- Builders can publish publicly or keep a passport unlisted.
- Agents can consume structured project JSON from the proof record.

## Why It Is AI-Native

ZeroScout uses an AI project analyst to turn raw project data into useful action:

- project brief
- technical summary
- 0G proof analysis
- readiness signal
- risks and fixes
- progress delta between checkpoints
- share kit for mentors, voters, sponsors, users, and agents

The AI output is stored inside the 0G-backed Project Passport.

## Exact 0G Usage

0G is the durable memory and proof layer.

- Project Passport JSON is uploaded to 0G Storage.
- Project comparison reports are uploaded to 0G Storage.
- Public passport roots can be registered on 0G Chain through `ZeroScoutRegistry`, giving the app a rebuildable public index from chain events.
- The app records storage root, content hash, network, timestamp, and transaction hash when available.
- Production metadata uses Railway Postgres when `DATABASE_URL` is set. Local development falls back to `server/data/index.json`.
- 0G Compute Router is preferred for AI generation when `ZG_COMPUTE_API_KEY` is configured.

Mainnet defaults:

```env
ZG_NETWORK=mainnet
ZG_RPC_URL=https://evmrpc.0g.ai
ZG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
ZG_CHAIN_ID=16661
ZG_REGISTRY_CONTRACT=0x...
ZG_REGISTRY_FROM_BLOCK=...
```

## Routes

```txt
/                  Create a Project Passport
/projects          Browse public Project Passports across every source
/projects/:id      Public Project Passport
/compare           Compare any two Project Passports
/integrate         Organization onboarding
/verify            How proof works
/embed/:campaignId Embeddable campaign widget
```

Legacy routes `/leaderboard`, `/matchup`, `/docs`, and `/campaigns` redirect to the current public routes.

## Plug-And-Play Integration

Organizations start at:

```txt
/integrate
```

Hosted campaign link:

```txt
https://zeroscout-arena-production.up.railway.app/?campaign=grail-builders-university
```

Prefilled link:

```txt
/?campaign=zero-cup&project=ZeroScout&repo=https://github.com/Cyano88/zeroscout-arena
```

The public product is optimized around the hosted link. The embed route and integration API exist for later platform integrations, but the visible onboarding flow does not require engineering work.

Embed route:

```html
<iframe src="https://zeroscout-arena-production.up.railway.app/embed/grail-builders-university" width="100%" height="760" style="border:0"></iframe>
```

Integration API:

```txt
GET /api/campaigns
GET /api/campaigns/:id
GET /api/campaigns/:id/capsules
POST /api/integrations/capsules
POST /api/integrations/video-score
```

Server-to-server integrations should use a named partner key:

```http
Authorization: Bearer zs_live_partner_key
```

Operators can issue keys with the admin API. Store the returned key immediately; ZeroScout stores only a hash and will not show the full key again.

```bash
curl -X POST https://zeroscout-arena-production.up.railway.app/api/admin/integration-keys \
  -H "Authorization: Bearer $ZEROSCOUT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"grail-production","partner":"Grail"}'
```

List and revoke keys:

```txt
GET  /api/admin/integration-keys
POST /api/admin/integration-keys/:id/revoke
```

Hosted links and iframe widgets do not need secrets. API keys are only for backend integrations that create passports or request video scoring programmatically.

### API Dashboard and Credits

ZeroScout also includes a self-serve API dashboard at:

```txt
/dashboard
```

Use this when an external platform wants ZeroScout as a simple 0G integration layer:

- Continue with Privy, or connect a browser wallet.
- Create a capped API key.
- Send native OG on 0G Chain to the configured treasury address.
- ZeroScout verifies confirmed treasury transfers and adds credits to that wallet's keys.
- API calls spend credits before ZeroScout uses 0G Storage or 0G Compute.

Default credit costs:

```txt
Project Passport API create: 20 credits
Video scoring API call: 50 credits
```

Production env:

```txt
DATABASE_URL=postgresql://...
ZEROSCOUT_TREASURY_ADDRESS=0x...
ZEROSCOUT_CREDITS_PER_OG=100
VITE_PRIVY_APP_ID=your_privy_app_id
```

`DATABASE_URL` is required for durable API keys, credits, top-ups, usage, and indexed Project Passports on Railway. The server still stores only hashed API keys; full secrets are shown once and can be rotated if lost.

Privy is optional but recommended for public onboarding. In the Privy dashboard, configure:

- App name: ZeroScout.
- Login methods: email, Google, and wallet.
- Embedded wallets: create for users without wallets.
- Allowed origins: `https://zeroscout.app`, the Railway URL, and local dev URLs you use.
- Theme: dark, with the ZeroScout mark and a restrained purple accent.

Integration choice:

- Hosted link: no env, best for sending builders one URL.
- Embed widget: no env for public forms, best inside university/cohort portals.
- API key: backend env required, best for native platform flows like Grail video scoring.

## Campaign Templates

- Zero Cup: hackathon campaign with tournament checkpoints.
- Grail Builders University: cohort campaign with application, weekly, and demo-day checkpoints.
- Solo Builder Program: flexible template for independent builders, grants, launches, and private progress trails.

## Stack

- Frontend: Vite, React, TypeScript
- Backend: Node, Express, TypeScript
- Storage: `@0gfoundation/0g-storage-ts-sdk`, `ethers`
- AI: 0G Compute Router first, OpenAI-compatible fallback if configured
- Deployment: Railway full-stack deployment

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Deploy the optional 0G Chain registry:

```bash
npm run deploy:registry
```

Then set `ZG_REGISTRY_CONTRACT` and `ZG_REGISTRY_FROM_BLOCK` in Railway. Once configured, new public passports are emitted as `PassportRegistered` events, and the Projects page can rebuild from chain events plus 0G Storage roots.

For production proof:

```env
ZG_PRIVATE_KEY=your_0g_mainnet_wallet_private_key
ZG_REGISTRY_CONTRACT=your_deployed_registry_contract
ZG_REGISTRY_FROM_BLOCK=deployment_block_number
ZG_COMPUTE_API_KEY=your_0g_router_key
DEV_STORAGE_FALLBACK=false
```

For local UI development without storage credentials:

```env
DEV_STORAGE_FALLBACK=true
```

Local fallback is clearly labeled and must not be used as a 0G proof claim.

## Demo Flow

1. Open ZeroScout.
2. Choose a campaign: Zero Cup, Grail Builders University, or Custom.
3. Enter project name, builder, repo, demo, checkpoint, product description, and 0G usage.
4. Create the Project Passport.
5. Show AI Scout Signal, readiness signal, next steps, and share kit.
6. Show the 0G proof status, storage root, content hash, and JSON artifact.
7. Open `/projects` to show public projects grouped by hackathon/ecosystem, university/cohort, and solo builder paths.
8. Open `/integrate` to show how a new organization starts from zero.
9. Open `/compare` to compare any two public Project Passports.

Unlisted passports are not shown in Projects, source lists, or Compare. They remain accessible by direct URL.

## Zero Cup Rules Alignment

- AI-native: the core workflow is an AI project analyst.
- 0G does real work: Project Passports and comparison reports are stored on 0G Storage.
- 0G Chain can hold the public root registry through `PassportRegistered` events.
- Built for the tournament window: scoped as a new repo and product.
- Public repo and working demo: this README and deployment docs define the path.
- Demo matches code: no hardcoded 0G responses.
- One team, one project: ZeroScout is the project.
- Improve and resubmit: checkpoints create versioned progress proof.

## Roadmap

Group Stage:
- Project Passport creation
- AI Scout Signal
- 0G Storage proof
- Public profile page
- Campaign links and embed preview

Round of 32:
- Better repo ingestion
- Wallet-linked builder profiles
- richer proof receipts

Round of 16:
- stronger comparison mode
- improvement deltas per checkpoint

Quarter Finals:
- community voting UI
- share cards
- campaign analytics

Semi/Final:
- live campaign dashboard
- social distribution layer
- stronger verification and analytics

## Product Language

Use:

- Project Passport
- readiness signal
- AI Scout Signal
- 0G proof
- checkpoint
- campaign
- share kit

Do not call ZeroScout output an official judge score or official ranking.
