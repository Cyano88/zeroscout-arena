# Deployment

## Railway Full-Stack Deploy

1. Create a Railway project.
2. Connect this repo.
3. Railway uses `railway.json`. The build command builds the client and server, and Express serves the React app:

```bash
npm install && npm run build
npm run start
```

4. Add environment variables:

```env
PORT=8787
CORS_ORIGIN=*
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

Never expose `ZG_PRIVATE_KEY` or AI keys in the frontend.

Deploy the registry contract once before setting registry env vars:

```bash
npm run deploy:registry
```

The deploy script prints `ZG_REGISTRY_CONTRACT`. Use the deployment block as `ZG_REGISTRY_FROM_BLOCK` so the app can scan only relevant registry events.

## Optional Vercel Frontend

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
