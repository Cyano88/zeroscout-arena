import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { CapsuleIndexRecord, ClaimStartResponse, MatchupReport, ProjectCapsule } from "../../shared/types.js";
import { findCampaignPreset } from "../../shared/campaigns.js";
import { projectKeyFor } from "./services/project-key.js";

interface StoreFile {
  capsules: CapsuleIndexRecord[];
  capsuleBodies: Record<string, ProjectCapsule>;
  matchups: MatchupReport[];
  pendingClaims?: Record<string, PendingClaim>;
}

interface PendingClaim extends ClaimStartResponse {
  capsuleId: string;
  createdAt: string;
}

const storePath = path.join(process.cwd(), config.dataDir, "index.json");

const emptyStore: StoreFile = {
  capsules: [],
  capsuleBodies: {},
  matchups: [],
  pendingClaims: {}
};

async function ensureStore(): Promise<void> {
  await mkdir(path.dirname(storePath), { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(emptyStore, null, 2));
  }
}

async function readStore(): Promise<StoreFile> {
  await ensureStore();
  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw) as StoreFile;
}

async function writeStore(store: StoreFile): Promise<void> {
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function listCapsules(): Promise<CapsuleIndexRecord[]> {
  const store = await readStore();
  return store.capsules.map(withCampaignDefaults).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPublicCapsules(): Promise<CapsuleIndexRecord[]> {
  const all = await listCapsules();
  return all.filter((item) => item.visibility !== "unlisted");
}

export async function listCapsulesByCampaign(campaignId: string): Promise<CapsuleIndexRecord[]> {
  const all = await listCapsules();
  return all.filter((item) => item.campaignId === campaignId);
}

export async function listCapsulesByProjectKey(projectKey: string): Promise<CapsuleIndexRecord[]> {
  const all = await listCapsules();
  return all.filter((item) => item.projectKey === projectKey);
}

export async function listPublicCapsulesByCampaign(campaignId: string): Promise<CapsuleIndexRecord[]> {
  const all = await listPublicCapsules();
  return all.filter((item) => item.campaignId === campaignId);
}

export async function getCapsule(id: string): Promise<ProjectCapsule | undefined> {
  const store = await readStore();
  const capsule = store.capsuleBodies[id];
  return capsule ? withCapsuleCampaignDefaults(capsule) : undefined;
}

export async function saveCapsule(capsule: ProjectCapsule): Promise<void> {
  const store = await readStore();
  const normalized = withCapsuleCampaignDefaults(capsule);
  const campaign = findCampaignPreset(normalized.campaignId);
  const record: CapsuleIndexRecord = {
    id: normalized.id,
    projectKey: normalized.projectKey,
    versionNumber: normalized.versionNumber,
    previousCapsuleId: normalized.previousCapsuleId,
    ownership: normalized.ownership,
    videoReview: normalized.videoReview,
    projectName: normalized.projectName,
    teamName: normalized.teamName,
    tagline: normalized.tagline,
    repoUrl: normalized.repoUrl,
    round: normalized.round,
    stage: normalized.stage,
    campaignId: normalized.campaignId ?? campaign.id,
    campaignName: normalized.campaignName ?? campaign.name,
    campaignType: normalized.campaignType ?? campaign.type,
    checkpointLabel: normalized.checkpointLabel ?? normalized.round,
    helpNeeded: normalized.helpNeeded,
    visibility: normalized.visibility,
    scores: normalized.scores,
    storageRoot: normalized.storageRoot,
    storageUri: normalized.storageUri,
    capsuleHash: normalized.capsuleHash,
    storageTxHash: normalized.storageTxHash,
    registryTxHash: normalized.registryTxHash,
    network: normalized.network,
    storageMode: normalized.storageMode,
    aiProvider: normalized.aiProvider,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };

  store.capsuleBodies[normalized.id] = normalized;
  store.capsules = [record, ...store.capsules.filter((item) => item.id !== normalized.id)];
  await writeStore(store);
}

export async function saveMatchup(matchup: MatchupReport): Promise<void> {
  const store = await readStore();
  store.matchups = [matchup, ...store.matchups.filter((item) => item.id !== matchup.id)];
  await writeStore(store);
}

export async function listMatchups(): Promise<MatchupReport[]> {
  const store = await readStore();
  return store.matchups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function savePendingClaim(claim: PendingClaim): Promise<void> {
  const store = await readStore();
  store.pendingClaims = store.pendingClaims ?? {};
  store.pendingClaims[claim.capsuleId] = claim;
  await writeStore(store);
}

export async function getPendingClaim(capsuleId: string): Promise<PendingClaim | undefined> {
  const store = await readStore();
  return store.pendingClaims?.[capsuleId];
}

export async function clearPendingClaim(capsuleId: string): Promise<void> {
  const store = await readStore();
  if (!store.pendingClaims) return;
  delete store.pendingClaims[capsuleId];
  await writeStore(store);
}

function withCampaignDefaults(record: CapsuleIndexRecord): CapsuleIndexRecord {
  const campaign = findCampaignPreset(record.campaignId);
  return {
    ...record,
    projectKey: record.projectKey ?? projectKeyFor(record.campaignId, record.storageUri),
    versionNumber: record.versionNumber ?? 1,
    repoUrl: record.repoUrl ?? "",
    campaignId: record.campaignId ?? campaign.id,
    campaignName: record.campaignName ?? campaign.name,
    campaignType: record.campaignType ?? campaign.type,
    checkpointLabel: record.checkpointLabel ?? record.round
  };
}

function withCapsuleCampaignDefaults(capsule: ProjectCapsule): ProjectCapsule {
  const campaign = findCampaignPreset(capsule.campaignId);
  return {
    ...capsule,
    projectKey: capsule.projectKey ?? projectKeyFor(capsule.campaignId, capsule.repoUrl),
    versionNumber: capsule.versionNumber ?? 1,
    campaignId: capsule.campaignId ?? campaign.id,
    campaignName: capsule.campaignName ?? campaign.name,
    campaignType: capsule.campaignType ?? campaign.type,
    checkpointLabel: capsule.checkpointLabel ?? capsule.round,
    checkpointNumber: capsule.checkpointNumber ?? campaign.checkpoints.indexOf(capsule.checkpointLabel ?? capsule.round)
  };
}
