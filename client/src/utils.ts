import type { ProjectCapsule, ScoreSet } from "../../shared/types";

export function shortHash(value?: string): string {
  if (!value) return "pending";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function scoreRows(scores: ScoreSet) {
  return [
    ["0G depth", scores.ogNativeDepth, 35],
    ["AI usefulness", scores.aiNativeUsefulness, 25],
    ["Demo clarity", scores.demoClarity, 15],
    ["Product polish", scores.productPolish, 15],
    ["Shareability", scores.communityShareability, 10]
  ] as const;
}

export function isRealProof(mode: ProjectCapsule["storageMode"]): boolean {
  return mode !== "local-dev-fallback";
}

export function explorerTxUrl(network: string, txHash?: string): string | null {
  if (!txHash) return null;
  const base = network.includes("mainnet") ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai";
  return `${base}/tx/${txHash}`;
}
