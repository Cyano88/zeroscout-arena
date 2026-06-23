# Deployment

## Railway Backend

1. Create a Railway project.
2. Connect this repo.
3. Set the service start command:

```bash
npm run build:server && npm run start
```

4. Add environment variables:

```env
PORT=8787
CORS_ORIGIN=https://your-frontend-domain.vercel.app
ZG_NETWORK=mainnet
ZG_RPC_URL=https://evmrpc.0g.ai
ZG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
ZG_CHAIN_ID=16661
ZG_EXPLORER_URL=https://chainscan.0g.ai
ZG_STORAGE_EXPLORER_URL=https://storagescan.0g.ai
ZG_PRIVATE_KEY=...
ZG_COMPUTE_API_KEY=...
ZG_COMPUTE_BASE_URL=https://router-api.0g.ai/v1
ZG_COMPUTE_MODEL=zai-org/GLM-5-FP8
DEV_STORAGE_FALLBACK=false
```

Never expose `ZG_PRIVATE_KEY` or AI keys in the frontend.

## Vercel Frontend

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
- Creating a capsule fails if 0G upload fails.
- Public capsule page shows mainnet proof, not local fallback.
