# Deployment

## Railway Full-Stack Deploy

Railway is the primary ZeroScout deployment. Express serves both the API and the built React app, which keeps 0G Storage, 0G Compute, video upload review, API keys, and top-up verification on one origin.
Production deploys should come from the `main` branch.

1. Create a Railway project.
2. Connect this repo.
3. Add a Railway Postgres database to the same project. Railway injects `DATABASE_URL`; ZeroScout uses it for durable API keys, credits, top-ups, usage, and Project Passport indexes.
4. Railway uses `railway.json`. The build command builds the client and server, and Express serves the React app:

```bash
npm install && npm run build
npm run start
```

5. Add environment variables:

```env
PORT=8787
CORS_ORIGIN=*
DATABASE_URL=${{Postgres.DATABASE_URL}}
ZG_NETWORK=mainnet
ZG_RPC_URL=https://evmrpc.0g.ai
ZG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
ZG_CHAIN_ID=16661
ZG_EXPLORER_URL=https://chainscan.0g.ai
ZG_STORAGE_EXPLORER_URL=https://storagescan.0g.ai
ZG_PRIVATE_KEY=...
ZG_REGISTRY_CONTRACT=...
ZG_REGISTRY_FROM_BLOCK=...
ZG_COMPUTE_API_KEY=...
ZG_COMPUTE_BASE_URL=https://router-api.0g.ai/v1
ZG_COMPUTE_MODEL=zai-org/GLM-5-FP8
DEV_STORAGE_FALLBACK=false
```

Never expose `ZG_PRIVATE_KEY`, `ZG_COMPUTE_API_KEY`, `DATABASE_URL`, or generated `zs_live...` API keys in the frontend.

Deploy the registry contract once before setting registry env vars:

```bash
npm run deploy:registry
```

The deploy script prints `ZG_REGISTRY_CONTRACT`. Use the deployment block as `ZG_REGISTRY_FROM_BLOCK` so the app can scan only relevant registry events.

## Optional Vercel Frontend

Vercel is frontend-only for this repo. It cannot replace Railway unless the frontend points at the Railway API.

1. Import the repo into Vercel.
2. Build command:

```bash
npm run build:client
```

3. Output directory:

```bash
dist/client
```

4. Add:

```env
VITE_API_BASE_URL=https://your-railway-api.up.railway.app
```

If `VITE_API_BASE_URL` is missing, the Vercel build may deploy but the app will call Vercel for `/api/*`, where the ZeroScout Express API does not exist.

## Production Check

- `/api/health` returns `storageConfigured: true`.
- `/api/config/public` says storage mode is `0G mainnet`.
- `/api/config/public` includes the registry contract when configured.
- Creating a Project Passport fails if 0G upload fails.
- Public Project Passport page shows stored proof, not local fallback.
- Public Project Passport page shows `Registry tx` when chain registration is configured.
- `/projects` lists only public Project Passports.
- `/integrate` shows the hosted-link onboarding path.
- `/embed/grail-builders-university` loads the optional embedded widget.
