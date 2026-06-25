# ZeroScout Demo Script

## 90-Second Walkthrough

1. Open `https://zeroscout-arena-production.up.railway.app`.
2. Say: "ZeroScout turns builder progress into a verified Project Passport for hackathons, cohorts, grants, universities, and ecosystem programs."
3. Create or open a Project Passport.
4. Show the repo, live demo, checkpoint, 0G usage claim, AI Scout Signal, readiness signal, next steps, and share copy.
5. Say: "This is not an official judge score. It is an AI scouting signal that helps builders and programs understand what is real, what is weak, and what should ship next."
6. Show the proof fields: storage root, content hash, storage transaction, registry transaction, and AI provider.
7. Say: "0G is not a badge here. The canonical Project Passport JSON is stored on 0G Storage, the passport root is recorded through the 0G Chain registry, and 0G Compute Router generates Scout Signals and video review when configured."
8. Open `/dashboard`.
9. Show the API key, wallet credit pool, video review cost, and Passport API cost.
10. Say: "External programs can plug into ZeroScout without rebuilding 0G Storage or Compute. They keep their own user experience and call ZeroScout from their backend."
11. Open Grail and show the Outside The Box verification flow.
12. Upload a short video and click Review.
13. Show that Grail starts a ZeroScout session, uploads the video directly to ZeroScout, stores/reviews it through 0G, and returns points back to Grail.
14. Say: "This is the real distribution path: Grail already rewards users and is preparing builder cohorts, so ZeroScout can onboard builders into 0G-powered proof without asking every platform to learn the full 0G stack."

## Short Proof Line

"If 0G is removed, ZeroScout loses its source-of-truth record, proof receipts, Compute-backed review, and reusable API layer. The product is the 0G-backed builder proof graph."

## Fallback If Video Review Is Slow

"The Grail integration is live through a capped ZeroScout API key. If the video model is still processing, the important proof is that Grail reaches ZeroScout, starts a session, charges wallet credits, and routes review through the same 0G Storage and Compute pipeline used by the public Project Passport flow."
