import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { CapsuleIndexRecord, MatchupReport, ProjectCapsule } from "../../shared/types.js";
import { findCampaignPreset } from "../../shared/campaigns.js";

interface StoreFile {
  capsules: CapsuleIndexRecord[];
  capsuleBodies: Record<string, ProjectCapsule>;
  matchups: MatchupReport[];
}

const storePath = path.join(process.cwd(), config.dataDir, "index.json");

const emptyStore: StoreFile = {
  capsules: [],
  capsuleBodies: {},
  matchups: []
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

export async function listCapsulesByCampaign(campaignId: string): Promise<CapsuleIndexRecord[]> {
  const all = await listCapsules();
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
    projectName: normalized.projectName,
    teamName: normalized.teamName,
    tagline: normalized.tagline,
    round: normalized.round,
    stage: normalized.stage,
    campaignId: normalized.campaignId ?? campaign.id,
    campaignName: normalized.campaignName ?? campaign.name,
    campaignType: normalized.campaignType ?? campaign.type,
    checkpointLabel: normalized.checkpointLabel ?? normalized.round,
    helpNeeded: normalized.helpNeeded,
    scores: normalized.scores,
    storageRoot: normalized.storageRoot,
    storageUri: normalized.storageUri,
    capsuleHash: normalized.capsuleHash,
    storageTxHash: normalized.storageTxHash,
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

function withCampaignDefaults(record: CapsuleIndexRecord): CapsuleIndexRecord {
  const campaign = findCampaignPreset(record.campaignId);
  return {
    ...record,
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
    campaignId: capsule.campaignId ?? campaign.id,
    campaignName: capsule.campaignName ?? campaign.name,
    campaignType: capsule.campaignType ?? campaign.type,
    checkpointLabel: capsule.checkpointLabel ?? capsule.round,
    checkpointNumber: capsule.checkpointNumber ?? campaign.checkpoints.indexOf(capsule.checkpointLabel ?? capsule.round)
  };
}
