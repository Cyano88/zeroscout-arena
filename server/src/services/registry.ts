import { ethers } from "ethers";
import { config } from "../config.js";
import type { CapsuleIndexRecord, ProjectCapsule } from "../../../shared/types.js";
import { loadCanonicalArtifact } from "./storage.js";
import { findCampaignPreset } from "../../../shared/campaigns.js";

const registryAbi = [
  "event PassportRegistered(string id, bytes32 indexed root, bytes32 capsuleHash, bytes32 storageTxHash, string campaignId, bool isPublic, uint256 createdAt)",
  "function registerPassport(string id, bytes32 root, bytes32 capsuleHash, bytes32 storageTxHash, string campaignId, bool isPublic) external"
];

export function registryConfigured(): boolean {
  return Boolean(config.registryContract);
}

export async function registerPassportOnChain(capsule: ProjectCapsule): Promise<string | undefined> {
  if (!config.registryContract || !config.privateKey || capsule.storageMode === "local-dev-fallback") return undefined;

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const signer = new ethers.Wallet(config.privateKey, provider);
  const contract = new ethers.Contract(config.registryContract, registryAbi, signer);
  const tx = await contract.registerPassport(
    capsule.id,
    toBytes32(capsule.storageRoot),
    toBytes32(capsule.capsuleHash),
    toBytes32(capsule.storageTxHash),
    capsule.campaignId ?? "custom",
    capsule.visibility !== "unlisted"
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function listRegistryCapsules(): Promise<CapsuleIndexRecord[]> {
  if (!config.registryContract) return [];

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const contract = new ethers.Contract(config.registryContract, registryAbi, provider);
  const filter = contract.filters.PassportRegistered();
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, config.registryFromBlock);
  const logs = await queryLogsInBatches(contract, filter, fromBlock, latest);
  const newestById = new Map<string, { root: string; tx: string; isPublic: boolean }>();

  for (const log of logs) {
    const parsed = contract.interface.parseLog(log);
    if (!parsed) continue;
    newestById.set(parsed.args.id, {
      root: parsed.args.root,
      tx: parsed.args.storageTxHash === ethers.ZeroHash ? "" : parsed.args.storageTxHash,
      isPublic: parsed.args.isPublic
    });
  }

  const records = await Promise.all(
    [...newestById.entries()]
      .filter(([, value]) => value.isPublic)
      .map(async ([id, value]) => loadRegistryRecord(id, value.root, value.tx).catch(() => undefined))
  );

  return records.filter((item): item is CapsuleIndexRecord => Boolean(item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function queryLogsInBatches(contract: ethers.Contract, filter: ethers.DeferredTopicFilter, fromBlock: number, latest: number): Promise<ethers.EventLog[]> {
  const logs: ethers.EventLog[] = [];
  const batchSize = 4500;
  for (let start = fromBlock; start <= latest; start += batchSize + 1) {
    const end = Math.min(latest, start + batchSize);
    const batch = await contract.queryFilter(filter, start, end);
    logs.push(...batch.filter((item): item is ethers.EventLog => "args" in item));
  }
  return logs;
}

async function loadRegistryRecord(id: string, root: string, tx: string): Promise<CapsuleIndexRecord | undefined> {
  const downloaded = await loadCanonicalArtifact(root);
  const artifact = downloaded.artifact as Partial<ProjectCapsule> & { id?: string; artifactType?: string };
  if (artifact.id !== id || artifact.artifactType !== "zeroscout.project-capsule" || artifact.visibility === "unlisted") return undefined;

  const campaign = findCampaignPreset(artifact.campaignId);
  return {
    id,
    projectName: artifact.projectName ?? "Untitled project",
    teamName: artifact.teamName ?? "Unknown builder",
    tagline: artifact.tagline ?? "",
    round: artifact.round ?? "Group Stage",
    stage: artifact.stage ?? "MVP",
    campaignId: artifact.campaignId ?? campaign.id,
    campaignName: artifact.campaignName ?? campaign.name,
    campaignType: artifact.campaignType ?? campaign.type,
    checkpointLabel: artifact.checkpointLabel ?? artifact.round ?? campaign.checkpointLabel,
    helpNeeded: artifact.helpNeeded,
    visibility: artifact.visibility,
    scores: artifact.scores ?? {
      ogNativeDepth: 0,
      aiNativeUsefulness: 0,
      demoClarity: 0,
      productPolish: 0,
      communityShareability: 0,
      total: 0
    },
    storageRoot: root,
    storageUri: `0g://${config.network}/${root}`,
    capsuleHash: downloaded.capsuleHash,
    storageTxHash: tx || artifact.storageTxHash,
    registryTxHash: artifact.registryTxHash,
    network: `0G ${config.network}`,
    storageMode: config.network === "mainnet" ? "0g-mainnet" : "0g-testnet",
    aiProvider: artifact.aiProvider ?? "unknown",
    createdAt: artifact.createdAt ?? new Date(0).toISOString(),
    updatedAt: artifact.updatedAt ?? artifact.createdAt ?? new Date(0).toISOString()
  };
}

function toBytes32(value?: string): string {
  return value && /^0x[a-fA-F0-9]{64}$/.test(value) ? value : ethers.ZeroHash;
}
