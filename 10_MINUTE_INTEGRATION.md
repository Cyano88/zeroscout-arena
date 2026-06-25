# Integrate ZeroScout in 10 Minutes

ZeroScout lets a platform add 0G-backed Project Passports and video scoring without rebuilding 0G Storage, 0G Compute, or proof pages.

Use this path when your app already has users and you want ZeroScout behind your own experience.

## 1. Create a Server Key

Open:

```txt
https://zeroscout-arena-production.up.railway.app/dashboard
```

Connect your wallet, create an API key, and fund the wallet credit pool with OG. Credits are shared across active keys owned by the wallet.

Costs:

```txt
Project Passport API: 5 credits
Video review API: 20 credits
Rate: 100 credits per OG
```

## 2. Add Backend Env Vars

Add these only to your backend or serverless environment:

```env
ZEROSCOUT_API_URL=https://zeroscout-arena-production.up.railway.app
ZEROSCOUT_INTEGRATION_SECRET=zs_live_your_key
```

Never expose the key in browser JavaScript, public env vars, iframe URLs, or mobile bundles.

## 3. Create a Project Passport

Call this from your backend when you already collected builder/project details:

```http
POST /api/integrations/capsules
Authorization: Bearer $ZEROSCOUT_INTEGRATION_SECRET
Content-Type: application/json
```

Minimum payload:

```json
{
  "projectName": "Builder App",
  "teamName": "Team Name",
  "tagline": "One clear outcome.",
  "repoUrl": "https://github.com/team/repo",
  "demoUrl": "https://demo.example",
  "round": "Application",
  "stage": "MVP",
  "visibility": "public",
  "description": "Who uses it and what they get.",
  "ogUsageClaims": "What 0G powers in the product.",
  "pitchNotes": "What people should remember."
}
```

ZeroScout returns a public Project Passport URL plus 0G proof fields.

## 4. Score a Video

Use this when your platform collects a user video and wants 0G-backed review:

```http
POST /api/integrations/video-score
Authorization: Bearer $ZEROSCOUT_INTEGRATION_SECRET
Content-Type: multipart/form-data
```

Fields:

```txt
video: MP4, MOV, or WebM under 100 MB
platform: Your platform name
program: Campaign, cohort, or grant name
projectName: Project or campaign being reviewed
prompt: What the model should evaluate
```

Response includes:

```txt
score
summary
recommendation
video.storageRoot
review.storageRoot
review.storageTxHash
aiProvider
```

## 5. Recommended UX

For users, say:

```txt
Upload a short walkthrough. ZeroScout stores the proof on 0G, reviews it with 0G Compute, and returns content points.
```

For admins, show:

```txt
Score, summary, proof root, review transaction, and credit usage.
```

## 6. What 0G Does

ZeroScout uses 0G as the proof and intelligence layer:

- 0G Storage stores canonical Project Passport JSON and video review artifacts.
- 0G Chain records public passport roots through the registry contract.
- 0G Compute Router generates AI Scout Signals and video review when configured.
- The local database is only an index for discovery, keys, usage, and fast page loading.
