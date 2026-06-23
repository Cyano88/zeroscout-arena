import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { CapsuleIndexRecord, MatchupReport, ProjectCapsule } from "../../shared/types.js";

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
  return store.capsules.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCapsule(id: string): Promise<ProjectCapsule | undefined> {
  const store = await readStore();
  return store.capsuleBodies[id];
}

export async function saveCapsule(capsule: ProjectCapsule): Promise<void> {
  const store = await readStore();
  const record: CapsuleIndexRecord = {
    id: capsule.id,
    projectName: capsule.projectName,
    teamName: capsule.teamName,
    tagline: capsule.tagline,
    round: capsule.round,
    stage: capsule.stage,
    scores: capsule.scores,
    storageRoot: capsule.storageRoot,
    storageUri: capsule.storageUri,
    capsuleHash: capsule.capsuleHash,
    storageTxHash: capsule.storageTxHash,
    network: capsule.network,
    storageMode: capsule.storageMode,
    aiProvider: capsule.aiProvider,
    createdAt: capsule.createdAt,
    updatedAt: capsule.updatedAt
  };

  store.capsuleBodies[capsule.id] = capsule;
  store.capsules = [record, ...store.capsules.filter((item) => item.id !== capsule.id)];
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
