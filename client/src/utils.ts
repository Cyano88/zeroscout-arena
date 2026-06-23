import type { ScoreSet } from "../../shared/types";

export function shortHash(value?: string): string {
  if (!value) return "pending";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function scoreRows(scores: ScoreSet) {
  return [
    ["0G Native Depth", scores.ogNativeDepth, 35],
    ["AI-Native Usefulness", scores.aiNativeUsefulness, 25],
    ["Demo Clarity", scores.demoClarity, 15],
    ["Product Polish", scores.productPolish, 15],
    ["Community Shareability", scores.communityShareability, 10]
  ] as const;
}

export function deadlineCopy(): string {
  const target = new Date("2026-06-23T23:59:59+01:00");
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "Group Stage snapshot locked";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h to Group Stage lock` : `${hours}h to Group Stage lock`;
}
