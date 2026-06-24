import { TextEncoder } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ethers } from "ethers";
import { config } from "../config.js";
import { sha256Hex } from "./hash.js";

export interface StorageResult {
  storageRoot: string;
  storageUri: string;
  capsuleHash: string;
  storageTxHash?: string;
  network: string;
  storageMode: "0g-mainnet" | "0g-testnet" | "local-dev-fallback";
}

export async function storeCanonicalArtifact(kind: "capsule" | "matchup" | "claim" | "video-review", id: string, artifact: unknown): Promise<StorageResult> {
  const canonicalJson = JSON.stringify(artifact, null, 2);
  const capsuleHash = sha256Hex(canonicalJson);

  if (config.privateKey) {
    return uploadToZeroG(canonicalJson, capsuleHash);
  }

  if (!config.devStorageFallback) {
    throw new Error("0G storage is not configured. Set ZG_PRIVATE_KEY or enable DEV_STORAGE_FALLBACK=true for local development only.");
  }

  const dir = path.join(process.cwd(), config.dataDir, "fallback-artifacts");
  await mkdir(dir, { recursive: true });
  const fallbackPath = path.join(dir, `${kind}-${id}.json`);
  await writeFile(fallbackPath, canonicalJson);

  return {
    storageRoot: capsuleHash,
    storageUri: `local-dev://${kind}/${id}`,
    capsuleHash,
    network: "local development fallback",
    storageMode: "local-dev-fallback"
  };
}

export async function loadCanonicalArtifact(rootHash: string): Promise<{ artifact: unknown; canonicalJson: string; capsuleHash: string }> {
  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
  const indexer = new Indexer(config.storageIndexer);
  const [blob, err] = await indexer.downloadToBlob(rootHash, { proof: false });
  if (err !== null) {
    throw new Error(`0G download error: ${err.message}`);
  }

  const canonicalJson = await blob.text();
  return {
    artifact: JSON.parse(canonicalJson) as unknown,
    canonicalJson,
    capsuleHash: sha256Hex(canonicalJson)
  };
}

async function uploadToZeroG(canonicalJson: string, capsuleHash: string): Promise<StorageResult> {
  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.privateKey!, provider);
  const indexer = new Indexer(config.storageIndexer);
  const data = new TextEncoder().encode(canonicalJson);
  const memData = new MemData(data);

  const [, treeErr] = await memData.merkleTree();
  if (treeErr !== null) {
    throw new Error(`0G Merkle tree error: ${treeErr}`);
  }

  const [tx, uploadErr] = await indexer.upload(memData, config.rpcUrl, signer as never);
  if (uploadErr !== null) {
    throw new Error(`0G upload error: ${uploadErr}`);
  }

  if ("rootHash" in tx) {
    return {
      storageRoot: tx.rootHash,
      storageUri: `0g://${config.network}/${tx.rootHash}`,
      capsuleHash,
      storageTxHash: tx.txHash,
      network: `0G ${config.network}`,
      storageMode: config.network === "mainnet" ? "0g-mainnet" : "0g-testnet"
    };
  }

  const root = tx.rootHashes[0];
  return {
    storageRoot: root,
    storageUri: `0g://${config.network}/${root}`,
    capsuleHash,
    storageTxHash: tx.txHashes[0],
    network: `0G ${config.network}`,
    storageMode: config.network === "mainnet" ? "0g-mainnet" : "0g-testnet"
  };
}
