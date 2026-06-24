import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { CapsuleIndexRecord, ClaimStartResponse, IntegrationKeyRecord, IntegrationTopUpRecord, MatchupReport, ProjectCapsule } from "../../shared/types.js";
import { findCampaignPreset } from "../../shared/campaigns.js";
import { projectKeyFor } from "./services/project-key.js";

interface StoreFile {
  capsules: CapsuleIndexRecord[];
  capsuleBodies: Record<string, ProjectCapsule>;
  matchups: MatchupReport[];
  pendingClaims?: Record<string, PendingClaim>;
  integrationKeys?: IntegrationKeyRecord[];
  integrationTopUps?: IntegrationTopUpRecord[];
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
  pendingClaims: {},
  integrationKeys: [],
  integrationTopUps: []
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

export async function listIntegrationKeys(): Promise<Omit<IntegrationKeyRecord, "keyHash">[]> {
  const store = await readStore();
  return (store.integrationKeys ?? [])
    .map(publicIntegrationKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listIntegrationKeysByWallet(wallet: string): Promise<Omit<IntegrationKeyRecord, "keyHash">[]> {
  const ownerWallet = wallet.toLowerCase();
  const store = await readStore();
  return (store.integrationKeys ?? [])
    .filter((item) => item.ownerWallet?.toLowerCase() === ownerWallet)
    .map(publicIntegrationKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveIntegrationKey(record: IntegrationKeyRecord): Promise<void> {
  const store = await readStore();
  const ownerWallet = record.ownerWallet?.toLowerCase();
  const pendingCredits = ownerWallet
    ? (store.integrationTopUps ?? [])
      .filter((item) => item.wallet.toLowerCase() === ownerWallet)
      .reduce((sum, item) => sum + Math.max(0, item.credits - (item.appliedCredits ?? 0)), 0)
    : 0;
  const normalized = { ...record, creditBalance: (record.creditBalance ?? 0) + pendingCredits };
  if (ownerWallet && pendingCredits > 0) {
    let remaining = pendingCredits;
    for (const topUp of store.integrationTopUps ?? []) {
      if (topUp.wallet.toLowerCase() !== ownerWallet || remaining <= 0) continue;
      const unapplied = Math.max(0, topUp.credits - (topUp.appliedCredits ?? 0));
      const applied = Math.min(unapplied, remaining);
      topUp.appliedCredits = (topUp.appliedCredits ?? 0) + applied;
      remaining -= applied;
    }
  }
  store.integrationKeys = [normalized, ...(store.integrationKeys ?? []).filter((item) => item.id !== record.id)];
  await writeStore(store);
}

export async function findActiveIntegrationKeyByHash(keyHash: string): Promise<IntegrationKeyRecord | undefined> {
  const store = await readStore();
  return (store.integrationKeys ?? []).find((item) => item.keyHash === keyHash && !item.revokedAt);
}

export async function claimIntegrationKeyByHash(keyHash: string, wallet: string, updates: { name?: string; partner?: string }): Promise<Omit<IntegrationKeyRecord, "keyHash"> | undefined> {
  const ownerWallet = wallet.toLowerCase();
  const store = await readStore();
  const target = (store.integrationKeys ?? []).find((item) => item.keyHash === keyHash && !item.revokedAt);
  if (!target) return undefined;
  if (target.ownerWallet && target.ownerWallet.toLowerCase() !== ownerWallet) {
    throw new Error("This API key is already attached to another wallet.");
  }
  target.ownerWallet = ownerWallet;
  if (updates.name) target.name = updates.name;
  if (updates.partner) target.partner = updates.partner;
  await writeStore(store);
  return publicIntegrationKey(target);
}

export async function touchIntegrationKey(id: string): Promise<void> {
  const store = await readStore();
  const keys = store.integrationKeys ?? [];
  const target = keys.find((item) => item.id === id);
  if (!target) return;
  target.lastUsedAt = new Date().toISOString();
  target.requestCount = (target.requestCount ?? 0) + 1;
  await writeStore(store);
}

export async function consumeIntegrationCredits(id: string, credits: number): Promise<IntegrationKeyRecord> {
  const store = await readStore();
  const target = (store.integrationKeys ?? []).find((item) => item.id === id && !item.revokedAt);
  if (!target) throw new Error("Integration key not found.");
  if ((target.creditBalance ?? 0) < credits) {
    throw new Error("Not enough ZeroScout credits. Top up this integration key.");
  }
  target.creditBalance = Math.max(0, (target.creditBalance ?? 0) - credits);
  target.creditsUsed = (target.creditsUsed ?? 0) + credits;
  target.lastUsedAt = new Date().toISOString();
  target.requestCount = (target.requestCount ?? 0) + 1;
  await writeStore(store);
  return target;
}

export async function addCreditsToWalletKeys(wallet: string, credits: number): Promise<Omit<IntegrationKeyRecord, "keyHash">[]> {
  const ownerWallet = wallet.toLowerCase();
  const store = await readStore();
  const owned = (store.integrationKeys ?? []).filter((item) => item.ownerWallet?.toLowerCase() === ownerWallet && !item.revokedAt);
  if (owned.length === 0) {
    await writeStore(store);
    return [];
  }
  for (const key of owned) {
    key.creditBalance = (key.creditBalance ?? 0) + credits;
  }
  let remaining = credits;
  for (const topUp of store.integrationTopUps ?? []) {
    if (topUp.wallet.toLowerCase() !== ownerWallet || remaining <= 0) continue;
    const unapplied = Math.max(0, topUp.credits - (topUp.appliedCredits ?? 0));
    const applied = Math.min(unapplied, remaining);
    topUp.appliedCredits = (topUp.appliedCredits ?? 0) + applied;
    remaining -= applied;
  }
  await writeStore(store);
  return owned.map(publicIntegrationKey);
}

export async function saveIntegrationTopUp(record: IntegrationTopUpRecord): Promise<void> {
  const store = await readStore();
  const existing = (store.integrationTopUps ?? []).find((item) => item.txHash.toLowerCase() === record.txHash.toLowerCase());
  if (existing) throw new Error("This top-up transaction was already used.");
  store.integrationTopUps = [record, ...(store.integrationTopUps ?? [])];
  await writeStore(store);
}

export async function hasIntegrationTopUp(txHash: string): Promise<boolean> {
  const store = await readStore();
  return (store.integrationTopUps ?? []).some((item) => item.txHash.toLowerCase() === txHash.toLowerCase());
}

export async function integrationTopUpSummary(wallet: string): Promise<{ creditedOg: string; creditsPurchased: number; topUpCount: number }> {
  const ownerWallet = wallet.toLowerCase();
  const store = await readStore();
  const topUps = (store.integrationTopUps ?? []).filter((item) => item.wallet.toLowerCase() === ownerWallet);
  const credited = topUps.reduce((sum, item) => sum + Number(item.amountOg), 0);
  return {
    creditedOg: credited.toFixed(6).replace(/\.?0+$/, ""),
    creditsPurchased: topUps.reduce((sum, item) => sum + item.credits, 0),
    topUpCount: topUps.length
  };
}

export async function revokeIntegrationKey(id: string): Promise<Omit<IntegrationKeyRecord, "keyHash"> | undefined> {
  const store = await readStore();
  const target = (store.integrationKeys ?? []).find((item) => item.id === id);
  if (!target) return undefined;
  target.revokedAt = target.revokedAt ?? new Date().toISOString();
  await writeStore(store);
  return publicIntegrationKey(target);
}

export async function revokeIntegrationKeyForWallet(id: string, wallet: string): Promise<Omit<IntegrationKeyRecord, "keyHash"> | undefined> {
  const ownerWallet = wallet.toLowerCase();
  const store = await readStore();
  const target = (store.integrationKeys ?? []).find((item) => item.id === id && item.ownerWallet?.toLowerCase() === ownerWallet);
  if (!target) return undefined;
  target.revokedAt = target.revokedAt ?? new Date().toISOString();
  await writeStore(store);
  return publicIntegrationKey(target);
}

function publicIntegrationKey(record: IntegrationKeyRecord): Omit<IntegrationKeyRecord, "keyHash"> {
  const { keyHash: _keyHash, ...publicRecord } = record;
  return {
    ...publicRecord,
    creditBalance: publicRecord.creditBalance ?? 0,
    creditsUsed: publicRecord.creditsUsed ?? 0
  };
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
