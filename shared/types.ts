export const rounds = [
  "Group Stage",
  "Round of 32",
  "Round of 16",
  "Quarter Finals",
  "Semi Finals",
  "Final"
] as const;

export const stages = ["prototype", "MVP", "live", "scaling"] as const;
export const campaignTypes = ["hackathon", "cohort", "grant", "accelerator", "demo-day", "custom"] as const;

export type Round = (typeof rounds)[number];
export type ProjectStage = (typeof stages)[number];
export type CampaignType = (typeof campaignTypes)[number];

export interface CampaignPreset {
  id: string;
  name: string;
  type: CampaignType;
  description: string;
  checkpointLabel: string;
  checkpoints: string[];
  helpOptions: string[];
}

export interface ScoreSet {
  ogNativeDepth: number;
  aiNativeUsefulness: number;
  demoClarity: number;
  productPolish: number;
  communityShareability: number;
  total: number;
}

export interface CampaignPack {
  voterPitch: string;
  xPost: string;
  telegramPost: string;
  sponsorSummary: string;
}

export interface SurvivalDelta {
  previousCapsuleId: string;
  improved: string[];
  stillWeak: string[];
  ogUsageDelta: string;
  demoClarityDelta: string;
  communityReadinessDelta: string;
  topPriorities: string[];
}

export interface ProjectOwnershipClaim {
  status: "claimed";
  method: "repo-file";
  claimedBy: string;
  claimRoot: string;
  claimHash: string;
  claimTxHash?: string;
  claimRegistryTxHash?: string;
  verifiedAt: string;
}

export interface ClaimStartResponse {
  claimCode: string;
  expectedPath: string;
  expectedContent: string;
  rawUrls: string[];
}

export interface ProjectCapsuleInput {
  projectName: string;
  teamName: string;
  tagline: string;
  repoUrl: string;
  demoUrl: string;
  videoDemoUrl?: string;
  creatorWallet?: string;
  round: Round;
  description: string;
  ogUsageClaims: string;
  pitchNotes?: string;
  stage: ProjectStage;
  previousCapsuleId?: string;
  campaignId?: string;
  campaignName?: string;
  campaignType?: CampaignType;
  checkpointLabel?: string;
  checkpointNumber?: number;
  builderWallet?: string;
  builderEmail?: string;
  mentorFocus?: string;
  helpNeeded?: string;
  visibility?: "public" | "unlisted";
  source?: "hosted" | "deeplink" | "widget" | "api";
  externalUserId?: string;
  externalOrgId?: string;
}

export interface ProjectCapsule extends ProjectCapsuleInput {
  id: string;
  projectKey: string;
  versionNumber: number;
  ownership?: ProjectOwnershipClaim;
  aiProvider: string;
  scoutBrief: string;
  technicalSummary: string;
  proofAnalysis: string;
  scores: ScoreSet;
  risks: string[];
  nextRoundTasks: string[];
  campaignPack: CampaignPack;
  survivalDelta?: SurvivalDelta;
  storageRoot: string;
  storageUri: string;
  capsuleHash: string;
  storageTxHash?: string;
  registryTxHash?: string;
  network: string;
  storageMode: "0g-mainnet" | "0g-testnet" | "local-dev-fallback";
  createdAt: string;
  updatedAt: string;
}

export interface CapsuleIndexRecord {
  id: string;
  projectKey: string;
  versionNumber: number;
  previousCapsuleId?: string;
  ownership?: ProjectOwnershipClaim;
  projectName: string;
  teamName: string;
  tagline: string;
  repoUrl: string;
  round: Round;
  stage: ProjectStage;
  campaignId: string;
  campaignName: string;
  campaignType: CampaignType;
  checkpointLabel: string;
  helpNeeded?: string;
  visibility?: "public" | "unlisted";
  scores: ScoreSet;
  storageRoot: string;
  storageUri: string;
  capsuleHash: string;
  storageTxHash?: string;
  registryTxHash?: string;
  network: string;
  storageMode: ProjectCapsule["storageMode"];
  aiProvider: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchupReport {
  id: string;
  capsuleAId: string;
  capsuleBId: string;
  capsuleAName: string;
  capsuleBName: string;
  summary: string;
  strongerProof: string;
  clearerDemo: string;
  strongerPublicVoteCase: string;
  risksForA: string[];
  risksForB: string[];
  nextMoveForA: string;
  nextMoveForB: string;
  aiProvider: string;
  storageRoot: string;
  storageUri: string;
  capsuleHash: string;
  storageTxHash?: string;
  registryTxHash?: string;
  network: string;
  storageMode: ProjectCapsule["storageMode"];
  createdAt: string;
}

export interface PublicConfig {
  network: string;
  chainId: number;
  storageIndexer: string;
  explorerUrl: string;
  storageExplorerUrl: string;
  registryContract?: string;
  computeMode: string;
  storageMode: string;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  network: string;
  storageConfigured: boolean;
  aiConfigured: boolean;
}

export interface AiHealthResponse {
  configured: boolean;
  ok: boolean;
  provider: string;
  model?: string;
  trustMode?: string;
  error?: string;
}
