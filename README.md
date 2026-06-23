# ZeroScout

ZeroScout is a plug-and-play proof layer for builder programs.

It turns a builder's repo, demo, and checkpoint notes into an AI-reviewed Project Passport stored on 0G. Hackathons, universities, grant programs, accelerators, demo days, and ecosystem teams can use it to collect real progress proof without building their own review system.

Zero Cup is the launch campaign. Grail Builders University is the first real-world cohort template.

## What It Does

- Builders create public Project Passports.
- AI generates a scout brief, readiness signal, risks, next steps, and share copy.
- 0G stores the canonical proof capsule.
- Organizations get campaign links, campaign dashboards, and embed/API paths.
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
- The app records storage root, content hash, network, timestamp, and transaction hash when available.
- The local JSON index is only for discovery and routing.
- 0G Compute Router is preferred for AI generation when `ZG_COMPUTE_API_KEY` is configured.

Mainnet defaults:

```env
ZG_NETWORK=mainnet
ZG_RPC_URL=https://evmrpc.0g.ai
ZG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
ZG_CHAIN_ID=16661
```

## Routes

```txt
/                  Create a Project Passport
/projects          Browse public Project Passports across every source
/projects/:id      Public Project Passport
/compare           Compare any two Project Passports
/integrate         Organization onboarding and integration paths
/verify            How proof works
/embed/:campaignId Embeddable campaign widget
```

Legacy routes `/leaderboard`, `/matchup`, and `/docs` redirect to the new routes.

## Plug-And-Play Integration

Organizations can start at:

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

Embed:

```html
<iframe src="https://zeroscout-arena-production.up.railway.app/embed/grail-builders-university" width="100%" height="760" style="border:0"></iframe>
```

Campaign API:

```txt
GET /api/campaigns
GET /api/campaigns/:id
GET /api/campaigns/:id/capsules
POST /api/integrations/capsules
```

## Campaign Templates

- Zero Cup: hackathon campaign with tournament checkpoints.
- Grail Builders University: cohort campaign with application, weekly, and demo-day checkpoints.
- Custom Builder Program: flexible template for grants, accelerators, demo days, and internal programs.

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

For production proof:

```env
ZG_PRIVATE_KEY=your_0g_mainnet_wallet_private_key
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

## Zero Cup Rules Alignment

- AI-native: the core workflow is an AI project analyst.
- 0G does real work: Project Passports and comparison reports are stored on 0G Storage.
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
