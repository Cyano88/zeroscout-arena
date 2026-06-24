import express from "express";
import cors from "cors";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ethers } from "ethers";
import { config, publicConfig } from "./config.js";
import { capsuleInputSchema, matchupInputSchema } from "./validation.js";
import { addCreditsToWalletKeys, claimIntegrationKeyByHash, clearPendingClaim, consumeIntegrationCredits, findActiveIntegrationKeyByHash, getCapsule, getPendingClaim, getVideoScoreSession, hasIntegrationTopUp, integrationTopUpSummary, listCapsulesByProjectKey, listIntegrationKeys, listIntegrationKeysByWallet, listMatchups, listPublicCapsules, markVideoScoreSessionUsed, revokeIntegrationKey, revokeIntegrationKeyForWallet, saveCapsule, saveIntegrationKey, saveIntegrationTopUp, saveMatchup, savePendingClaim, saveVideoScoreSession } from "./repository.js";
import { checkAiHealth, generateMatchup, generatePlatformVideoScore, generateScout, generateUploadedVideoReview, generateVideoReview } from "./services/ai.js";
import { loadBinaryArtifact, loadCanonicalArtifact, storeBinaryArtifact, storeCanonicalArtifact } from "./services/storage.js";
import { getRegistryClaim, listRegistryCapsules, registerClaimOnChain, registerPassportOnChain } from "./services/registry.js";
import { parseGitHubRepo, projectKeyFor } from "./services/project-key.js";
import type { CapsuleIndexRecord, ClaimStartResponse, HealthResponse, MatchupReport, ProjectCapsule, ProjectCapsuleInput, VideoReview } from "../../shared/types.js";
import { campaignPresets, findCampaignPreset } from "../../shared/campaigns.js";

const app = express();
const maxVideoBytes = 100 * 1024 * 1024;
const integrationCosts = {
  capsule: 5,
  videoScore: 20
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxVideoBytes },
  fileFilter: (_req, file, cb) => {
    if (["video/mp4", "video/quicktime", "video/webm"].includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Upload an MP4, MOV, or WebM video under 100 MB."));
  }
});

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

app.get("/api/integrations/pricing", (_req, res) => {
  res.json({
    costs: integrationCosts,
    creditsPerOg: config.creditsPerOg,
    treasuryAddress: config.treasuryAddress,
    chainId: config.chainId,
    network: config.network
  });
});

app.get("/api/ai/health", async (_req, res, next) => {
  try {
    res.json(await checkAiHealth());
  } catch (error) {
    next(error);
  }
});

app.get("/api/campaigns", (_req, res) => {
  res.json(campaignPresets);
});

app.get("/api/campaigns/:id", async (req, res, next) => {
  try {
    const campaign = findCampaignPreset(req.params.id);
    const capsules = await listPublicLatestCapsulesMerged();
    const campaignCapsules = capsules.filter((item) => item.campaignId === campaign.id);
    res.json({
      ...campaign,
      profileCount: campaignCapsules.length,
      storedProofs: campaignCapsules.filter((item) => item.storageMode !== "local-dev-fallback").length,
      latestProfiles: campaignCapsules.slice(0, 8)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/campaigns/:id/capsules", async (req, res, next) => {
  try {
    const campaign = findCampaignPreset(req.params.id);
    const capsules = await listPublicLatestCapsulesMerged();
    res.json(capsules.filter((item) => item.campaignId === campaign.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/capsules", async (_req, res, next) => {
  try {
    res.json(await listPublicCapsulesMerged());
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", async (_req, res, next) => {
  try {
    res.json(await listPublicLatestCapsulesMerged());
  } catch (error) {
    next(error);
  }
});

app.get("/api/capsules/:id", async (req, res, next) => {
  try {
    const capsule = await hydrateCapsuleOwnership(await getCapsule(req.params.id) ?? await recoverCapsuleFromRoot(req.params.id, req.query.root, req.query.tx));
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
    const capsule = await hydrateCapsuleOwnership(await getCapsule(req.params.id) ?? await recoverCapsuleFromRoot(req.params.id, req.query.root, req.query.tx));
    if (!capsule) {
      res.status(404).json({ error: "Capsule not found" });
      return;
    }
    res.type("application/json").send(JSON.stringify(capsule, null, 2));
  } catch (error) {
    next(error);
  }
});

app.get("/api/capsules/:id/versions", async (req, res, next) => {
  try {
    const capsule = await hydrateCapsuleOwnership(await getCapsule(req.params.id) ?? await recoverCapsuleFromRoot(req.params.id, req.query.root, req.query.tx));
    if (!capsule) {
      res.status(404).json({ error: "Capsule not found" });
      return;
    }
    const projectName = capsule.projectName.trim().toLowerCase();
    const versions = (await listCapsulesByProjectKey(capsule.projectKey))
      .filter((item) => item.id === capsule.id || item.projectName.trim().toLowerCase() === projectName);
    res.json(versions.sort((a, b) => (b.versionNumber ?? 1) - (a.versionNumber ?? 1) || b.createdAt.localeCompare(a.createdAt)));
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

app.post("/api/capsules/:id/claim/start", async (req, res, next) => {
  try {
    const capsule = await getCapsule(req.params.id);
    if (!capsule) {
      res.status(404).json({ error: "Project Passport not found." });
      return;
    }
    if (capsule.ownership?.status === "claimed") {
      res.status(409).json({ error: "This project is already claimed." });
      return;
    }

    const repo = parseGitHubRepo(capsule.repoUrl);
    if (!repo) {
      res.status(400).json({ error: "Repo file proof currently supports GitHub repository URLs only." });
      return;
    }

    const claimCode = `zs_${nanoid(12)}`;
    const expectedContent = claimFileContent(capsule, claimCode);
    const response: ClaimStartResponse = {
      claimCode,
      expectedPath: ".well-known/zeroscout.txt",
      expectedContent,
      rawUrls: rawClaimUrls(repo.owner, repo.repo)
    };

    await savePendingClaim({
      ...response,
      capsuleId: capsule.id,
      createdAt: new Date().toISOString()
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/capsules/:id/claim/verify", async (req, res, next) => {
  try {
    const capsule = await getCapsule(req.params.id);
    if (!capsule) {
      res.status(404).json({ error: "Project Passport not found." });
      return;
    }
    if (capsule.ownership?.status === "claimed") {
      res.status(409).json({ error: "This project is already claimed." });
      return;
    }

    const pending = await getPendingClaim(capsule.id);
    if (!pending) {
      res.status(400).json({ error: "Start a claim first so ZeroScout can generate a fresh verification file." });
      return;
    }

    const verifiedUrl = await findVerifiedClaimFile(pending.rawUrls, pending.expectedContent);
    if (!verifiedUrl) {
      res.status(400).json({ error: "Verification file not found yet. Add .well-known/zeroscout.txt to the repo, then try again." });
      return;
    }

    const now = new Date().toISOString();
    const claimArtifact = {
      artifactType: "zeroscout.ownership-claim",
      artifactVersion: "1.0.0",
      projectId: capsule.id,
      projectKey: capsule.projectKey,
      projectName: capsule.projectName,
      repoUrl: capsule.repoUrl,
      method: "repo-file",
      verifiedUrl,
      claimCode: pending.claimCode,
      verifiedAt: now
    };
    const proof = await storeCanonicalArtifact("claim", capsule.id, claimArtifact);
    const updated: ProjectCapsule = {
      ...capsule,
      ownership: {
        status: "claimed",
        method: "repo-file",
        claimedBy: verifiedUrl,
        claimRoot: proof.storageRoot,
        claimHash: proof.capsuleHash,
        claimTxHash: proof.storageTxHash,
        verifiedAt: now
      },
      updatedAt: now
    };
    const claimRegistryTxHash = await registerClaimOnChain(updated);
    if (claimRegistryTxHash && updated.ownership) {
      updated.ownership.claimRegistryTxHash = claimRegistryTxHash;
    }

    await saveCapsule(updated);
    await clearPendingClaim(capsule.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post("/api/capsules/:id/video-review", async (req, res, next) => {
  try {
    const capsule = await hydrateCapsuleOwnership(await getCapsule(req.params.id) ?? await recoverCapsuleFromRoot(req.params.id, req.query.root, req.query.tx));
    if (!capsule) {
      res.status(404).json({ error: "Project Passport not found." });
      return;
    }
    if (!capsule.videoDemoUrl) {
      res.status(400).json({ error: "Add a video walkthrough URL before requesting a video review." });
      return;
    }

    await assertVideoSize(capsule.videoDemoUrl);

    const id = nanoid(10);
    const now = new Date().toISOString();
    const review = await generateVideoReview(capsule);
    const artifactWithoutProof = {
      id,
      artifactType: "zeroscout.video-review",
      artifactVersion: "1.0.0",
      capsuleId: capsule.id,
      projectKey: capsule.projectKey,
      projectName: capsule.projectName,
      videoUrl: capsule.videoDemoUrl,
      ...review,
      createdAt: now
    };
    const proof = await storeCanonicalArtifact("video-review", id, artifactWithoutProof);
    const videoReview: VideoReview = {
      id,
      capsuleId: capsule.id,
      videoUrl: capsule.videoDemoUrl,
      ...review,
      ...proof,
      createdAt: now
    };
    const updated: ProjectCapsule = {
      ...capsule,
      videoReview,
      updatedAt: now
    };
    await saveCapsule(updated);
    res.status(201).json(videoReview);
  } catch (error) {
    next(error);
  }
});

app.post("/api/capsules/:id/video-upload-review", upload.single("video"), async (req, res, next) => {
  try {
    const capsuleId = String(req.params.id);
    const capsule = await hydrateCapsuleOwnership(await getCapsule(capsuleId) ?? await recoverCapsuleFromRoot(capsuleId, req.query.root, req.query.tx));
    if (!capsule) {
      res.status(404).json({ error: "Project Passport not found." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Upload an MP4, MOV, or WebM video under 100 MB." });
      return;
    }

    const id = nanoid(10);
    const now = new Date().toISOString();
    const videoProof = await storeBinaryArtifact("video", id, req.file.buffer);
    const videoUrl = `${publicBaseUrl(req)}/api/video-assets/${encodeURIComponent(videoProof.storageRoot)}?contentType=${encodeURIComponent(req.file.mimetype)}`;
    const review = await generateUploadedVideoReview(capsule, videoUrl);
    const artifactWithoutProof = {
      id,
      artifactType: "zeroscout.video-review",
      artifactVersion: "1.0.0",
      capsuleId: capsule.id,
      projectKey: capsule.projectKey,
      projectName: capsule.projectName,
      videoUrl,
      uploadedVideo: {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        sizeBytes: req.file.size,
        storageRoot: videoProof.storageRoot,
        storageUri: videoProof.storageUri,
        contentHash: videoProof.capsuleHash,
        storageTxHash: videoProof.storageTxHash
      },
      ...review,
      createdAt: now
    };
    const proof = await storeCanonicalArtifact("video-review", id, artifactWithoutProof);
    const videoReview: VideoReview = {
      id,
      capsuleId: capsule.id,
      videoUrl,
      videoStorageRoot: videoProof.storageRoot,
      videoStorageUri: videoProof.storageUri,
      videoStorageTxHash: videoProof.storageTxHash,
      videoContentHash: videoProof.capsuleHash,
      videoContentType: req.file.mimetype,
      videoSizeBytes: req.file.size,
      ...review,
      ...proof,
      createdAt: now
    };
    const updated: ProjectCapsule = {
      ...capsule,
      videoReview,
      updatedAt: now
    };
    await saveCapsule(updated);
    res.status(201).json(videoReview);
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/video-score", upload.single("video"), async (req, res, next) => {
  try {
    let integration: { id: string; name: string; partner?: string } | undefined;
    try {
      integration = await assertIntegrationAccess(req, integrationCosts.videoScore);
    } catch (error) {
      res.status(errorStatus(error)).json({ error: stageError("API key", error) });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Upload an MP4, MOV, or WebM video under 100 MB." });
      return;
    }

    await respondWithPlatformVideoScore(req, res, integration, {
      platform: cleanBodyField(req.body.platform, "Grail"),
      program: cleanBodyField(req.body.program, "campaign video review"),
      projectName: cleanBodyField(req.body.projectName, "target project"),
      prompt: cleanBodyField(req.body.prompt, "")
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/video-score/session", async (req, res, next) => {
  try {
    const integration = await assertIntegrationIdentity(req);
    const token = randomBytes(24).toString("base64url");
    const now = Date.now();
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString();
    await saveVideoScoreSession({
      token,
      integrationId: integration?.id,
      integrationName: integration?.name,
      integrationPartner: integration?.partner,
      platform: cleanBodyField(req.body.platform, "Grail"),
      program: cleanBodyField(req.body.program, "campaign video review"),
      projectName: cleanBodyField(req.body.projectName, "target project"),
      prompt: cleanBodyField(req.body.prompt, ""),
      createdAt: new Date(now).toISOString(),
      expiresAt
    });
    res.status(201).json({
      uploadUrl: `${publicBaseUrl(req)}/api/integrations/video-score/session/${encodeURIComponent(token)}`,
      expiresAt,
      maxVideoBytes
    });
  } catch (error) {
    res.status(errorStatus(error)).json({ error: stageError("API key", error) });
  }
});

app.post("/api/integrations/video-score/session/:token", upload.single("video"), async (req, res, next) => {
  try {
    const token = String(req.params.token ?? "");
    const session = await getVideoScoreSession(token);
    if (!session) {
      res.status(404).json({ error: "Video upload session was not found. Start a new review." });
      return;
    }
    if (session.usedAt) {
      res.status(409).json({ error: "Video upload session was already used. Start a new review." });
      return;
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      res.status(410).json({ error: "Video upload session expired. Start a new review." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Upload an MP4, MOV, or WebM video under 100 MB." });
      return;
    }

    let integration = session.integrationId
      ? { id: session.integrationId, name: session.integrationName ?? "Integration key", partner: session.integrationPartner }
      : undefined;
    if (session.integrationId && session.integrationId !== "legacy-env") {
      try {
        const charged = await consumeIntegrationCredits(session.integrationId, integrationCosts.videoScore);
        integration = { id: charged.id, name: charged.name, partner: charged.partner };
      } catch (error) {
        res.status(errorStatus(error)).json({ error: stageError("API key", error) });
        return;
      }
    }

    await markVideoScoreSessionUsed(token);
    await respondWithPlatformVideoScore(req, res, integration, {
      platform: session.platform,
      program: session.program,
      projectName: session.projectName,
      prompt: session.prompt
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/capsules", async (req, res, next) => {
  try {
    await assertIntegrationAccess(req, integrationCosts.capsule);
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

app.get("/api/dashboard/keys", async (req, res, next) => {
  try {
    const wallet = walletParam(req.query.wallet);
    const [keys, balance] = await Promise.all([
      listIntegrationKeysByWallet(wallet),
      integrationTopUpSummary(wallet)
    ]);
    res.json({ keys, balance });
  } catch (error) {
    next(error);
  }
});

app.post("/api/dashboard/keys", async (req, res, next) => {
  try {
    const wallet = walletParam(req.body?.wallet);
    const name = cleanBodyField(req.body?.name, "production").slice(0, 80);
    const partner = cleanBodyField(req.body?.partner, "External platform").slice(0, 80);
    const id = nanoid(8);
    const secret = randomBytes(24).toString("base64url");
    const key = `zs_live_${id}_${secret}`;
    const record = {
      id,
      name,
      partner,
      ownerWallet: wallet,
      keyHash: hashSecret(key),
      keyPreview: `${key.slice(0, 16)}...${key.slice(-4)}`,
      creditBalance: 0,
      creditsUsed: 0,
      createdAt: new Date().toISOString(),
      requestCount: 0
    };
    await saveIntegrationKey(record);
    const { keyHash: _keyHash, ...publicRecord } = record;
    res.status(201).json({ ...publicRecord, key });
  } catch (error) {
    next(error);
  }
});

app.post("/api/dashboard/keys/import", async (req, res, next) => {
  try {
    const wallet = walletParam(req.body?.wallet);
    const key = cleanBodyField(req.body?.key, "").slice(0, 180);
    const name = cleanBodyField(req.body?.name, "").slice(0, 80);
    const partner = cleanBodyField(req.body?.partner, "").slice(0, 80);
    const message = cleanBodyField(req.body?.message, "").slice(0, 300);
    const signature = cleanBodyField(req.body?.signature, "").slice(0, 300);
    const expectedMessage = dashboardActionMessage("import-key", wallet, "existing-key");
    if (!key.startsWith("zs_live_")) {
      res.status(400).json({ error: "Enter a valid ZeroScout API key." });
      return;
    }
    if (message !== expectedMessage || !signature) {
      res.status(401).json({ error: "Wallet signature is required to attach this key." });
      return;
    }
    const signer = ethers.verifyMessage(message, signature);
    if (signer.toLowerCase() !== wallet.toLowerCase()) {
      res.status(401).json({ error: "Wallet signature does not match the connected wallet." });
      return;
    }
    const record = await claimIntegrationKeyByHash(hashSecret(key), wallet, { name, partner });
    if (!record) {
      res.status(404).json({ error: "API key was not found. Create a new key and update your platform env." });
      return;
    }
    res.json(record);
  } catch (error) {
    next(error);
  }
});

app.post("/api/dashboard/keys/:id/revoke", async (req, res, next) => {
  try {
    const wallet = walletParam(req.body?.wallet);
    const message = cleanBodyField(req.body?.message, "").slice(0, 300);
    const signature = cleanBodyField(req.body?.signature, "").slice(0, 300);
    const expectedMessage = dashboardActionMessage("revoke-key", wallet, req.params.id);
    if (message !== expectedMessage || !signature) {
      res.status(401).json({ error: "Wallet signature is required to revoke this key." });
      return;
    }
    const signer = ethers.verifyMessage(message, signature);
    if (signer.toLowerCase() !== wallet.toLowerCase()) {
      res.status(401).json({ error: "Wallet signature does not match the connected wallet." });
      return;
    }
    const record = await revokeIntegrationKeyForWallet(req.params.id, wallet);
    if (!record) {
      res.status(404).json({ error: "Key not found for the connected wallet." });
      return;
    }
    res.json(record);
  } catch (error) {
    next(error);
  }
});

function dashboardActionMessage(action: string, wallet: string, targetId: string) {
  return [
    "ZeroScout API dashboard",
    `Action: ${action}`,
    `Wallet: ${wallet.toLowerCase()}`,
    `Target: ${targetId}`
  ].join("\n");
}

app.post("/api/dashboard/topups/verify", async (req, res, next) => {
  try {
    const wallet = walletParam(req.body?.wallet);
    const txHash = cleanBodyField(req.body?.txHash, "").slice(0, 80);
    if (!ethers.isHexString(txHash, 32)) {
      res.status(400).json({ error: "Enter a valid 0G Chain transaction hash." });
      return;
    }
    if (!config.treasuryAddress || !ethers.isAddress(config.treasuryAddress)) {
      throw new Error("Top-ups are not configured. Set ZEROSCOUT_TREASURY_ADDRESS.");
    }
    if (await hasIntegrationTopUp(txHash)) {
      res.status(409).json({ error: "This top-up transaction was already used." });
      return;
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
    const [tx, receipt] = await Promise.all([provider.getTransaction(txHash), provider.getTransactionReceipt(txHash)]);
    if (!tx || !receipt || receipt.status !== 1) {
      res.status(400).json({ error: "Top-up transaction is not confirmed yet." });
      return;
    }
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) {
      res.status(400).json({ error: "Top-up transaction must come from the connected wallet." });
      return;
    }
    if (!tx.to || tx.to.toLowerCase() !== config.treasuryAddress.toLowerCase()) {
      res.status(400).json({ error: "Top-up transaction was not sent to the ZeroScout treasury address." });
      return;
    }
    if (tx.value <= 0n) {
      res.status(400).json({ error: "Top-up transaction must send OG." });
      return;
    }

    const amountOg = ethers.formatEther(tx.value);
    const credits = Math.max(1, Math.floor(Number(amountOg) * config.creditsPerOg));
    const record = {
      id: nanoid(10),
      wallet,
      txHash,
      amountOg,
      credits,
      createdAt: new Date().toISOString()
    };
    await saveIntegrationTopUp(record);
    const keys = await addCreditsToWalletKeys(wallet, credits);
    res.json({ ...record, keys });
  } catch (error) {
    next(error);
  }
});

app.post("/api/dashboard/topups/sync", async (req, res, next) => {
  try {
    const wallet = walletParam(req.body?.wallet);
    if (!config.treasuryAddress || !ethers.isAddress(config.treasuryAddress)) {
      throw new Error("Top-ups are not configured. Set ZEROSCOUT_TREASURY_ADDRESS.");
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
    const latest = await provider.getBlockNumber();
    const start = Math.max(0, latest - Math.max(1, Math.min(config.topUpScanBlocks, 5000)));
    const credited = [];

    for (let blockNumber = latest; blockNumber >= start; blockNumber -= 1) {
      const block = await provider.getBlock(blockNumber, true);
      const txs = await blockTransactions(provider, block);
      for (const tx of txs) {
        if (tx.from.toLowerCase() !== wallet.toLowerCase()) continue;
        if (!tx.to || tx.to.toLowerCase() !== config.treasuryAddress.toLowerCase()) continue;
        if (tx.value <= 0n || await hasIntegrationTopUp(tx.hash)) continue;

        const amountOg = ethers.formatEther(tx.value);
        const credits = Math.max(1, Math.floor(Number(amountOg) * config.creditsPerOg));
        const record = {
          id: nanoid(10),
          wallet,
          txHash: tx.hash,
          amountOg,
          credits,
          createdAt: new Date().toISOString()
        };
        await saveIntegrationTopUp(record);
        credited.push(record);
      }
    }

    if (credited.length > 0) {
      await addCreditsToWalletKeys(wallet, credited.reduce((sum, item) => sum + item.credits, 0));
    }

    const [keys, balance] = await Promise.all([
      listIntegrationKeysByWallet(wallet),
      integrationTopUpSummary(wallet)
    ]);
    res.json({ credited, keys, balance, scannedBlocks: latest - start + 1 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/integration-keys", async (req, res, next) => {
  try {
    assertAdminAccess(req);
    res.json(await listIntegrationKeys());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/integration-keys", async (req, res, next) => {
  try {
    assertAdminAccess(req);
    const name = cleanBodyField(req.body?.name, "").slice(0, 80);
    const partner = cleanBodyField(req.body?.partner, "").slice(0, 80) || undefined;
    if (!name) {
      res.status(400).json({ error: "Key name is required." });
      return;
    }

    const id = nanoid(8);
    const secret = randomBytes(24).toString("base64url");
    const key = `zs_live_${id}_${secret}`;
    const record = {
      id,
      name,
      partner,
      keyHash: hashSecret(key),
      keyPreview: `${key.slice(0, 16)}...${key.slice(-4)}`,
      creditBalance: Number(req.body?.creditBalance ?? 0),
      creditsUsed: 0,
      createdAt: new Date().toISOString(),
      requestCount: 0
    };
    await saveIntegrationKey(record);
    const { keyHash: _keyHash, ...publicRecord } = record;
    res.status(201).json({ ...publicRecord, key });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/integration-keys/:id/revoke", async (req, res, next) => {
  try {
    assertAdminAccess(req);
    const record = await revokeIntegrationKey(req.params.id);
    if (!record) {
      res.status(404).json({ error: "Integration key not found." });
      return;
    }
    res.json(record);
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
  const projectKey = projectKeyFor(campaign.id, input.repoUrl);
  const projectVersions = await listCapsulesByProjectKey(projectKey);
  const latestVersion = projectVersions[0] ? await getCapsule(projectVersions[0].id) : undefined;
  const explicitPrevious = input.previousCapsuleId ? await getCapsule(input.previousCapsuleId) : undefined;
  const previous = explicitPrevious?.projectKey === projectKey ? explicitPrevious : latestVersion;
  const versionNumber = previous ? (previous.versionNumber ?? 1) + 1 : 1;
  const versionedInput: ProjectCapsuleInput = previous ? { ...input, previousCapsuleId: previous.id } : input;
  const id = nanoid(10);
  const now = new Date().toISOString();
  const scout = await generateScout(versionedInput, previous);
  const artifactWithoutProof = {
    id,
    projectKey,
    versionNumber,
    ...versionedInput,
    ...scout,
    createdAt: now,
    updatedAt: now,
    artifactType: "zeroscout.project-capsule",
    artifactVersion: "1.0.0",
    productUse: "AI-reviewed Project Passport for builder programs, campaigns, cohorts, grants, hackathons, and agent-readable project registries."
  };
  const proof = await storeCanonicalArtifact("capsule", id, artifactWithoutProof);
  const capsule: ProjectCapsule = { ...artifactWithoutProof, ...proof };
  const registryTxHash = await registerPassportOnChain(capsule);
  if (registryTxHash) {
    capsule.registryTxHash = registryTxHash;
  }
  await saveCapsule(capsule);
  return capsule;
}

async function listPublicCapsulesMerged() {
  const [local, registry] = await Promise.all([listPublicCapsules(), listRegistryCapsules()]);
  const byId = new Map(local.map((item) => [item.id, item]));
  for (const item of registry) {
    byId.set(item.id, { ...byId.get(item.id), ...item });
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listPublicLatestCapsulesMerged() {
  const all = await listPublicCapsulesMerged();
  const byProjectRecord = new Map<string, CapsuleIndexRecord>();
  for (const item of all) {
    const current = byProjectRecord.get(item.projectKey);
    const itemVersion = item.versionNumber ?? 1;
    const currentVersion = current?.versionNumber ?? 1;
    if (!current || itemVersion > currentVersion || (itemVersion === currentVersion && item.createdAt > current.createdAt)) {
      byProjectRecord.set(item.projectKey, item);
    }
  }
  return [...byProjectRecord.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function recoverCapsuleFromRoot(id: string, rootQuery: unknown, txQuery: unknown): Promise<ProjectCapsule | undefined> {
  const root = typeof rootQuery === "string" ? rootQuery : "";
  const tx = typeof txQuery === "string" ? txQuery : undefined;
  if (!/^0x[a-fA-F0-9]{64}$/.test(root)) return undefined;

  const downloaded = await loadCanonicalArtifact(root);
  const artifact = downloaded.artifact as Partial<ProjectCapsule> & { id?: string; artifactType?: string };
  if (artifact.id !== id || artifact.artifactType !== "zeroscout.project-capsule") return undefined;

  const capsule: ProjectCapsule = {
    ...(artifact as ProjectCapsule),
    projectKey: artifact.projectKey ?? projectKeyFor(artifact.campaignId, artifact.repoUrl ?? root),
    versionNumber: artifact.versionNumber ?? 1,
    storageRoot: root,
    storageUri: `0g://${config.network}/${root}`,
    capsuleHash: downloaded.capsuleHash,
    storageTxHash: tx,
    network: `0G ${config.network}`,
    storageMode: config.network === "mainnet" ? "0g-mainnet" : "0g-testnet"
  };

  if (capsule.visibility !== "unlisted") {
    await saveCapsule(capsule);
  }

  return capsule;
}

async function hydrateCapsuleOwnership(capsule: ProjectCapsule | undefined): Promise<ProjectCapsule | undefined> {
  if (!capsule || capsule.ownership?.status === "claimed") return capsule;
  const ownership = await getRegistryClaim(capsule.id);
  if (!ownership) return capsule;

  const updated: ProjectCapsule = {
    ...capsule,
    ownership,
    updatedAt: ownership.verifiedAt > capsule.updatedAt ? ownership.verifiedAt : capsule.updatedAt
  };
  if (updated.visibility !== "unlisted") {
    await saveCapsule(updated);
  }
  return updated;
}

function claimFileContent(capsule: ProjectCapsule, claimCode: string): string {
  return [
    `zeroscout-claim: ${claimCode}`,
    `project-id: ${capsule.id}`,
    `project-key: ${capsule.projectKey}`,
    `repo: ${capsule.repoUrl}`
  ].join("\n");
}

function rawClaimUrls(owner: string, repo: string): string[] {
  return ["main", "master"].map((branch) => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.well-known/zeroscout.txt`);
}

async function findVerifiedClaimFile(urls: string[], expectedContent: string): Promise<string | undefined> {
  const expected = normalizeClaimContent(expectedContent);
  for (const url of urls) {
    const response = await fetch(url, { headers: { "User-Agent": "ZeroScout-Arena" } }).catch(() => undefined);
    if (!response?.ok) continue;
    const text = await response.text();
    if (normalizeClaimContent(text) === expected) return url;
  }
  return undefined;
}

function normalizeClaimContent(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

async function assertVideoSize(videoUrl: string): Promise<void> {
  const response = await fetch(videoUrl, { method: "HEAD", headers: { "User-Agent": "ZeroScout-Arena" } }).catch(() => undefined);
  const size = response?.headers.get("content-length");
  if (!size) return;
  const bytes = Number(size);
  if (Number.isFinite(bytes) && bytes > maxVideoBytes) {
    throw new Error("Video walkthrough is too large. Use a link under 100 MB for 0G video review.");
  }
}

app.get("/api/video-assets/:root", async (req, res, next) => {
  try {
    const root = req.params.root;
    if (!/^0x[a-fA-F0-9]{64}$/.test(root)) {
      res.status(400).json({ error: "Invalid video root." });
      return;
    }
    const contentType = typeof req.query.contentType === "string" ? req.query.contentType : "video/mp4";
    const asset = await loadBinaryArtifact(root);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(asset.bytes.byteLength));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.send(Buffer.from(asset.bytes));
  } catch (error) {
    next(error);
  }
});

app.head("/api/video-assets/:root", async (req, res, next) => {
  try {
    const root = req.params.root;
    if (!/^0x[a-fA-F0-9]{64}$/.test(root)) {
      res.status(400).end();
      return;
    }
    const contentType = typeof req.query.contentType === "string" ? req.query.contentType : "video/mp4";
    const asset = await loadBinaryArtifact(root);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(asset.bytes.byteLength));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end();
  } catch (error) {
    next(error);
  }
});

function publicBaseUrl(req: express.Request): string {
  const protoHeader = req.get("x-forwarded-proto");
  const proto = typeof protoHeader === "string" ? protoHeader.split(",")[0].trim() : req.protocol;
  const host = req.get("host");
  if (!host) throw new Error("Could not determine public host for video review.");
  return `${proto}://${host}`;
}

function cleanBodyField(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, 500) : fallback;
}

function walletParam(value: unknown): string {
  const wallet = cleanBodyField(value, "").slice(0, 80);
  if (!ethers.isAddress(wallet)) throw new Error("Connect a valid wallet address.");
  return ethers.getAddress(wallet);
}

async function blockTransactions(provider: ethers.JsonRpcProvider, block: ethers.Block | null): Promise<Array<{ hash: string; from: string; to?: string | null; value: bigint }>> {
  if (!block) return [];
  const maybePrefetched = (block as unknown as { prefetchedTransactions?: Array<{ hash: string; from: string; to?: string | null; value: bigint }> }).prefetchedTransactions;
  if (Array.isArray(maybePrefetched) && maybePrefetched.length > 0) return maybePrefetched;
  const hashes = block.transactions.filter((item): item is string => typeof item === "string");
  const fetched = await Promise.all(hashes.map((hash) => provider.getTransaction(hash)));
  return fetched
    .filter((tx): tx is ethers.TransactionResponse => Boolean(tx))
    .map((tx) => ({ hash: tx.hash, from: tx.from, to: tx.to, value: tx.value }));
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function bearerToken(req: express.Request): string {
  const header = req.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

function assertAdminAccess(req: express.Request): void {
  if (!config.adminToken) {
    throw new Error("Admin API is not configured. Set ZEROSCOUT_ADMIN_TOKEN.");
  }
  if (!safeEqual(bearerToken(req), config.adminToken)) {
    throw new Error("Unauthorized admin request.");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error";
}

function errorStatus(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("Unauthorized")) return 401;
  if (message.includes("Not enough ZeroScout credits")) return 402;
  if (message.includes("not configured")) return 503;
  if (message.includes("timed out") || message.includes("timeout")) return 504;
  return 400;
}

function stageError(stage: string, error: unknown): string {
  return `${stage} failed: ${errorMessage(error)}`;
}

async function respondWithPlatformVideoScore(
  req: express.Request,
  res: express.Response,
  integration: { id: string; name: string; partner?: string } | undefined,
  input: { platform: string; program: string; projectName: string; prompt: string }
): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "Upload an MP4, MOV, or WebM video under 100 MB." });
    return;
  }

  const id = nanoid(10);
  const now = new Date().toISOString();
  let videoProof;
  try {
    videoProof = await storeBinaryArtifact("video", id, req.file.buffer);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: stageError("0G video storage", error) });
    return;
  }

  const videoUrl = `${publicBaseUrl(req)}/api/video-assets/${encodeURIComponent(videoProof.storageRoot)}?contentType=${encodeURIComponent(req.file.mimetype)}`;
  let score;
  try {
    score = await generatePlatformVideoScore({ videoUrl, ...input });
  } catch (error) {
    res.status(errorStatus(error)).json({ error: stageError("0G Compute video review", error) });
    return;
  }

  const artifactWithoutProof = {
    id,
    artifactType: "zeroscout.platform-video-score",
    artifactVersion: "1.0.0",
    integrationId: integration?.id,
    integrationName: integration?.name,
    platform: input.platform,
    program: input.program,
    projectName: input.projectName,
    prompt: input.prompt,
    uploadedVideo: {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
      storageRoot: videoProof.storageRoot,
      storageUri: videoProof.storageUri,
      contentHash: videoProof.capsuleHash,
      storageTxHash: videoProof.storageTxHash
    },
    ...score,
    createdAt: now
  };
  let reviewProof;
  try {
    reviewProof = await storeCanonicalArtifact("video-review", id, artifactWithoutProof);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: stageError("0G review proof storage", error) });
    return;
  }

  res.status(201).json({
    id,
    ...score,
    video: {
      storageRoot: videoProof.storageRoot,
      storageUri: videoProof.storageUri,
      contentHash: videoProof.capsuleHash,
      storageTxHash: videoProof.storageTxHash,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size
    },
    review: {
      storageRoot: reviewProof.storageRoot,
      storageUri: reviewProof.storageUri,
      contentHash: reviewProof.capsuleHash,
      storageTxHash: reviewProof.storageTxHash
    },
    network: reviewProof.network,
    storageMode: reviewProof.storageMode,
    integration: integration ? { id: integration.id, name: integration.name, partner: integration.partner } : undefined,
    createdAt: now
  });
}

async function assertIntegrationAccess(req: express.Request, requiredCredits: number): Promise<{ id: string; name: string; partner?: string } | undefined> {
  const token = bearerToken(req);
  if (token) {
    const record = await findActiveIntegrationKeyByHash(hashSecret(token));
    if (record) {
      const charged = await consumeIntegrationCredits(record.id, requiredCredits);
      return { id: charged.id, name: charged.name, partner: charged.partner };
    }
  }

  if (config.integrationSecret) {
    if (safeEqual(token, config.integrationSecret)) {
      return { id: "legacy-env", name: "Legacy env secret" };
    }
    throw new Error("Unauthorized integration request.");
  }

  const configuredKeys = await listIntegrationKeys();
  if (configuredKeys.length > 0) {
    throw new Error("Unauthorized integration request.");
  }

  return undefined;
}

async function assertIntegrationIdentity(req: express.Request): Promise<{ id: string; name: string; partner?: string } | undefined> {
  const token = bearerToken(req);
  if (token) {
    const record = await findActiveIntegrationKeyByHash(hashSecret(token));
    if (record) {
      return { id: record.id, name: record.name, partner: record.partner };
    }
  }

  if (config.integrationSecret) {
    if (safeEqual(token, config.integrationSecret)) {
      return { id: "legacy-env", name: "Legacy env secret" };
    }
    throw new Error("Unauthorized integration request.");
  }

  const configuredKeys = await listIntegrationKeys();
  if (configuredKeys.length > 0) {
    throw new Error("Unauthorized integration request.");
  }

  return undefined;
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
    if (a.visibility === "unlisted" || b.visibility === "unlisted") {
      res.status(403).json({ error: "Only public Project Passports can be compared." });
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
  const status = message.includes("Unauthorized")
    ? 401
    : message.includes("not configured")
      ? 503
      : 400;
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`ZeroScout Arena API running on http://localhost:${config.port}`);
});
