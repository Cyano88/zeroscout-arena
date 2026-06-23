# ZeroScout Arena

ZeroScout turns a builder's repo, demo, and progress notes into a verified public project profile backed by 0G Storage.

For Zero Cup teams, it answers the practical questions that matter before every cut:

- What does this project do?
- What proof exists?
- What does 0G actually power?
- What should the team fix next?
- What should users, voters, backers, or agents share?

Zero Cup is the first supported arena. The same product can support hackathons, grants, accelerators, demo days, and ecosystem project discovery.

## Why It Is AI-Native

ZeroScout uses an AI project analyst to turn raw submission data into useful public output:

- Project brief
- Technical summary
- 0G proof analysis
- Project strength scores
- Risks and fixes
- Next steps
- Progress delta between two snapshots
- Share kit for public distribution

The AI output is not temporary UI text. It becomes part of the canonical project profile stored on 0G.

## Exact 0G Usage

ZeroScout uses 0G as the durable memory and proof layer.

- Canonical project profile JSON is uploaded to 0G Storage.
- Project comparison reports are uploaded to 0G Storage.
- The app records storage root hash, content hash, network, timestamp, and transaction hash when available.
- Local storage is only an index/cache for list pages and routing.
- 0G Compute Router is preferred for AI generation when `ZG_COMPUTE_API_KEY` is configured.

Mainnet defaults follow the official 0G docs:

```env
ZG_NETWORK=mainnet
ZG_RPC_URL=https://evmrpc.0g.ai
ZG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
ZG_CHAIN_ID=16661
```

## Stack

- Frontend: Vite, React, TypeScript
- Backend: Node, Express, TypeScript
- Storage: `@0gfoundation/0g-storage-ts-sdk`, `ethers`
- AI: 0G Compute Router first, OpenAI-compatible fallback if configured
- Deployment: Vercel frontend, Railway backend

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

For production proof, set:

```env
ZG_PRIVATE_KEY=your_0g_mainnet_wallet_private_key
ZG_COMPUTE_API_KEY=your_0g_router_key
DEV_STORAGE_FALLBACK=false
```

For local UI development without storage credentials:

```env
DEV_STORAGE_FALLBACK=true
```

Local fallback is clearly labeled and must not be used as a mainnet proof claim.

## Demo Flow

1. Open ZeroScout.
2. Enter project name, team, repo, demo, round, product description, and 0G usage.
3. Create a verified project page.
4. Backend packages the canonical profile JSON.
5. Backend uploads the artifact to 0G Storage mainnet.
6. Public profile page shows storage root, content hash, provider label, project brief, next steps, and share kit.
7. Create a second profile for the same project to show progress since the last proof.
8. Compare two projects and store the comparison report on 0G.

## Architecture

```txt
React UI
  -> Express API
    -> AI service
       -> 0G Compute Router when configured
       -> OpenAI-compatible fallback if configured
       -> deterministic local fallback for development
    -> canonical artifact packager
    -> 0G Storage SDK upload
    -> local JSON index/cache
```

## Zero Cup Rules Alignment

- AI-native: the core workflow is an AI project analyst.
- 0G does real work: canonical project profiles and comparison reports are stored on 0G Storage.
- Built for the tournament window: scoped as a new repo and product.
- Public repo and working demo: this README and deployment docs define the path.
- Demo matches code: no hardcoded 0G responses.
- One team, one project: ZeroScout is the project.
- Improve and resubmit: progress delta is built around round-by-round snapshots.

## Round Roadmap

Group Stage MVP:
- Verified project page creation
- AI project brief
- 0G Storage proof
- Public profile page

Round of 32:
- Better repo ingestion
- Wallet-linked team profiles
- Richer proof receipts

Round of 16:
- Stronger comparison mode
- More specific progress deltas by opponent

Quarter Finals:
- Community voting UI
- Share cards
- Campaign analytics

Semi/Final:
- Live project dashboard
- Social distribution layer
- Stronger verification and proof analytics

## Product Language

Use:

- Verified project profile
- Project strength
- 0G proof
- Progress delta
- Share kit

Do not call ZeroScout output an official judge score or official ranking.
