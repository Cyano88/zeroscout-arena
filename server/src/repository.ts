import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
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
  videoScoreSessions?: Record<string, VideoScoreSession>;
}

interface PendingClaim extends ClaimStartResponse {
  capsuleId: string;
  createdAt: string;
}

export interface VideoScoreSession {
  token: string;
  integrationId?: string;
  integrationName?: string;
  integrationPartner?: string;
  platform: string;
  program: string;
  projectName: string;
  prompt: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

const storePath = path.join(process.cwd(), config.dataDir, "index.json");
const pgPool = config.databaseUrl
  ? new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("railway.internal") ? false : { rejectUnauthorized: false }
  })
  : undefined;

const emptyStore: StoreFile = {
  capsules: [],
  capsuleBodies: {},
  matchups: [],
  pendingClaims: {},
  integrationKeys: [],
  integrationTopUps: [],
  videoScoreSessions: {}
};

async function ensureStore(): Promise<void> {
  if (pgPool) {
    await pgPool.query(`
      create table if not exists app_store (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )
    `);
    await pgPool.query(
      "insert into app_store (id, data) values ($1, $2::jsonb) on conflict (id) do nothing",
      ["main", JSON.stringify(emptyStore)]
    );
    return;
  }
  await mkdir(path.dirname(storePath), { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(emptyStore, null, 2));
  }
}

async function readStore(): Promise<StoreFile> {
  await ensureStore();
  if (pgPool) {
    const result = await pgPool.query<{ data: StoreFile }>("select data from app_store where id = $1", ["main"]);
    return normalizeStore(result.rows[0]?.data ?? emptyStore);
  }
  const raw = await readFile(storePath, "utf8");
  return normalizeStore(JSON.parse(raw) as StoreFile);
}

async function writeStore(store: StoreFile): Promise<void> {
  if (pgPool) {
    await ensureStore();
    await pgPool.query(
      "update app_store set data = $2::jsonb, updated_at = now() where id = $1",
      ["main", JSON.stringify(normalizeStore(store))]
    );
    return;
  }
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

function normalizeStore(store: StoreFile): StoreFile {
  return {
    capsules: store.capsules ?? [],
    capsuleBodies: store.capsuleBodies ?? {},
    matchups: store.matchups ?? [],
    pendingClaims: store.pendingClaims ?? {},
    integrationKeys: store.integrationKeys ?? [],
    integrationTopUps: store.integrationTopUps ?? [],
    videoScoreSessions: store.videoScoreSessions ?? {}
  };
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

export async function saveVideoScoreSession(session: VideoScoreSession): Promise<void> {
  const store = await readStore();
  store.videoScoreSessions = store.videoScoreSessions ?? {};
  store.videoScoreSessions[session.token] = session;
  await writeStore(store);
}

export async function getVideoScoreSession(token: string): Promise<VideoScoreSession | undefined> {
  const store = await readStore();
  return store.videoScoreSessions?.[token];
}

export async function markVideoScoreSessionUsed(token: string): Promise<void> {
  const store = await readStore();
  const session = store.videoScoreSessions?.[token];
  if (!session) return;
  session.usedAt = new Date().toISOString();
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
  const sharedBalance = walletCreditBalance(store, ownerWallet);
  return (store.integrationKeys ?? [])
    .filter((item) => item.ownerWallet?.toLowerCase() === ownerWallet)
    .map((item) => publicIntegrationKey(withSharedWalletBalance(item, sharedBalance)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveIntegrationKey(record: IntegrationKeyRecord): Promise<void> {
  const store = await readStore();
  const normalized = { ...record, creditBalance: record.creditBalance ?? 0, creditsUsed: record.creditsUsed ?? 0 };
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
  return publicIntegrationKey(withSharedWalletBalance(target, walletCreditBalance(store, ownerWallet)));
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
  const ownerWallet = target.ownerWallet?.toLowerCase();
  if (ownerWallet) {
    const sharedBalance = walletCreditBalance(store, ownerWallet);
    if (sharedBalance < credits) {
      throw new Error("Not enough ZeroScout credits. Top up the wallet that owns this integration key.");
    }
    target.creditsUsed = (target.creditsUsed ?? 0) + credits;
    target.lastUsedAt = new Date().toISOString();
    target.requestCount = (target.requestCount ?? 0) + 1;
    await writeStore(store);
    return withSharedWalletBalance(target, Math.max(0, sharedBalance - credits));
  }
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
  await writeStore(store);
  const sharedBalance = walletCreditBalance(store, ownerWallet);
  return owned.map((item) => publicIntegrationKey(withSharedWalletBalance(item, sharedBalance)));
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

function walletCreditBalance(store: StoreFile, ownerWallet: string): number {
  const purchased = (store.integrationTopUps ?? [])
    .filter((item) => item.wallet.toLowerCase() === ownerWallet)
    .reduce((sum, item) => sum + item.credits, 0);
  const used = (store.integrationKeys ?? [])
    .filter((item) => item.ownerWallet?.toLowerCase() === ownerWallet)
    .reduce((sum, item) => sum + (item.creditsUsed ?? 0), 0);
  return Math.max(0, purchased - used);
}

function withSharedWalletBalance(record: IntegrationKeyRecord, sharedBalance: number): IntegrationKeyRecord {
  return {
    ...record,
    creditBalance: sharedBalance
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
