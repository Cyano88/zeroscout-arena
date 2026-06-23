import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import path from "node:path";
import { config, publicConfig } from "./config.js";
import { capsuleInputSchema, matchupInputSchema } from "./validation.js";
import { getCapsule, listCapsules, listCapsulesByCampaign, listMatchups, listPublicCapsules, listPublicCapsulesByCampaign, saveCapsule, saveMatchup } from "./repository.js";
import { generateMatchup, generateScout } from "./services/ai.js";
import { storeCanonicalArtifact } from "./services/storage.js";
import type { HealthResponse, MatchupReport, ProjectCapsule, ProjectCapsuleInput } from "../../shared/types.js";
import { campaignPresets, findCampaignPreset } from "../../shared/campaigns.js";

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

app.get("/api/campaigns", (_req, res) => {
  res.json(campaignPresets);
});

app.get("/api/campaigns/:id", async (req, res, next) => {
  try {
    const campaign = findCampaignPreset(req.params.id);
    const capsules = await listPublicCapsulesByCampaign(campaign.id);
    res.json({
      ...campaign,
      profileCount: capsules.length,
      storedProofs: capsules.filter((item) => item.storageMode !== "local-dev-fallback").length,
      latestProfiles: capsules.slice(0, 8)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/campaigns/:id/capsules", async (req, res, next) => {
  try {
    const campaign = findCampaignPreset(req.params.id);
    res.json(await listPublicCapsulesByCampaign(campaign.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/capsules", async (_req, res, next) => {
  try {
    res.json(await listCapsules());
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", async (_req, res, next) => {
  try {
    res.json(await listPublicCapsules());
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
    const capsule = await createProjectCapsule(capsuleInputSchema.parse(req.body));
    res.status(201).json(capsule);
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", async (req, res, next) => {
  try {
    const capsule = await createProjectCapsule(capsuleInputSchema.parse(req.body));
    res.status(201).json(capsule);
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/capsules", async (req, res, next) => {
  try {
    const capsule = await createProjectCapsule(capsuleInputSchema.parse({ ...req.body, source: "api" }));
    res.status(201).json({
      id: capsule.id,
      projectUrl: `/projects/${capsule.id}`,
      capsuleUrl: `/api/capsules/${capsule.id}.json`,
      storageRoot: capsule.storageRoot,
      capsuleHash: capsule.capsuleHash,
      storageTxHash: capsule.storageTxHash,
      readinessSignal: capsule.scores.total
    });
  } catch (error) {
    next(error);
  }
});

async function createProjectCapsule(parsed: ProjectCapsuleInput): Promise<ProjectCapsule> {
  const campaign = findCampaignPreset(parsed.campaignId);
  const checkpoint = parsed.checkpointLabel ?? parsed.round ?? campaign.checkpointLabel;
  const input: ProjectCapsuleInput = {
    ...parsed,
    campaignId: campaign.id,
    campaignName: parsed.campaignName ?? campaign.name,
    campaignType: parsed.campaignType ?? campaign.type,
    checkpointLabel: checkpoint,
    checkpointNumber: parsed.checkpointNumber ?? Math.max(0, campaign.checkpoints.indexOf(checkpoint)),
    visibility: parsed.visibility ?? "public",
    source: parsed.source ?? "hosted"
  };
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
    productUse: "AI-reviewed Project Passport for builder programs, campaigns, cohorts, grants, hackathons, and agent-readable project registries."
  };
  const proof = await storeCanonicalArtifact("capsule", id, artifactWithoutProof);
  const capsule: ProjectCapsule = { ...artifactWithoutProof, ...proof };
  await saveCapsule(capsule);
  return capsule;
}

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

const clientDir = path.join(process.cwd(), "dist", "client");
app.use(express.static(clientDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(clientDir, "index.html"));
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
