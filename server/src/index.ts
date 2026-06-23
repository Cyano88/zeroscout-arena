import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { config, publicConfig } from "./config.js";
import { capsuleInputSchema, matchupInputSchema } from "./validation.js";
import { getCapsule, listCapsules, listMatchups, saveCapsule, saveMatchup } from "./repository.js";
import { generateMatchup, generateScout } from "./services/ai.js";
import { storeCanonicalArtifact } from "./services/storage.js";
import type { HealthResponse, MatchupReport, ProjectCapsule } from "../../shared/types.js";

const app = express();

app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    service: "zeroscout-arena-api",
    network: config.network,
    storageConfigured: Boolean(config.privateKey),
    aiConfigured: Boolean(config.computeApiKey || config.openAiApiKey)
  };
  res.json(body);
});

app.get("/api/config/public", (_req, res) => {
  res.json(publicConfig());
});

app.get("/api/capsules", async (_req, res, next) => {
  try {
    res.json(await listCapsules());
  } catch (error) {
    next(error);
  }
});

app.get("/api/capsules/:id", async (req, res, next) => {
  try {
    const capsule = await getCapsule(req.params.id);
    if (!capsule) {
      res.status(404).json({ error: "Capsule not found" });
      return;
    }
    res.json(capsule);
  } catch (error) {
    next(error);
  }
});

app.get("/api/capsules/:id.json", async (req, res, next) => {
  try {
    const capsule = await getCapsule(req.params.id);
    if (!capsule) {
      res.status(404).json({ error: "Capsule not found" });
      return;
    }
    res.type("application/json").send(JSON.stringify(capsule, null, 2));
  } catch (error) {
    next(error);
  }
});

app.post("/api/capsules", async (req, res, next) => {
  try {
    const input = capsuleInputSchema.parse(req.body);
    const previous = input.previousCapsuleId ? await getCapsule(input.previousCapsuleId) : undefined;
    const id = nanoid(10);
    const now = new Date().toISOString();
    const scout = await generateScout(input, previous);

    const artifactWithoutProof = {
      id,
      ...input,
      ...scout,
      createdAt: now,
      updatedAt: now,
      artifactType: "zeroscout.project-capsule",
      artifactVersion: "1.0.0",
      zeroCupUse: "AI Scout Signal and proof capsule for round-by-round tournament improvement."
    };

    const proof = await storeCanonicalArtifact("capsule", id, artifactWithoutProof);

    const capsule: ProjectCapsule = {
      ...artifactWithoutProof,
      ...proof
    };

    await saveCapsule(capsule);
    res.status(201).json(capsule);
  } catch (error) {
    next(error);
  }
});

app.get("/api/matchups", async (_req, res, next) => {
  try {
    res.json(await listMatchups());
  } catch (error) {
    next(error);
  }
});

app.post("/api/matchups", async (req, res, next) => {
  try {
    const input = matchupInputSchema.parse(req.body);
    if (input.capsuleAId === input.capsuleBId) {
      res.status(400).json({ error: "Choose two different capsules." });
      return;
    }

    const [a, b] = await Promise.all([getCapsule(input.capsuleAId), getCapsule(input.capsuleBId)]);
    if (!a || !b) {
      res.status(404).json({ error: "One or both capsules were not found." });
      return;
    }

    const id = nanoid(10);
    const now = new Date().toISOString();
    const analysis = await generateMatchup(a, b);
    const artifactWithoutProof = {
      id,
      capsuleAId: a.id,
      capsuleBId: b.id,
      capsuleAName: a.projectName,
      capsuleBName: b.projectName,
      ...analysis,
      createdAt: now,
      artifactType: "zeroscout.matchup-report",
      artifactVersion: "1.0.0"
    };

    const proof = await storeCanonicalArtifact("matchup", id, artifactWithoutProof);
    const matchup: MatchupReport = {
      ...artifactWithoutProof,
      ...proof
    };

    await saveMatchup(matchup);
    res.status(201).json(matchup);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("0G storage is not configured") ? 503 : 400;
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`ZeroScout Arena API running on http://localhost:${config.port}`);
});
