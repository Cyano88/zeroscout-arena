import dotenv from "dotenv";

dotenv.config();

const network = process.env.ZG_NETWORK ?? "mainnet";
const isMainnet = network === "mainnet";
const defaultLegacyRegistries = isMainnet ? "0xc8139e917eEccB8DAE47e14fb727B6EB71f9712E" : "";
const legacyRegistryEnv = process.env.ZG_LEGACY_REGISTRY_CONTRACTS;
const legacyRegistrySource = legacyRegistryEnv && ["none", "off", "disabled"].includes(legacyRegistryEnv.toLowerCase())
  ? ""
  : legacyRegistryEnv ?? defaultLegacyRegistries;

export const config = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  network,
  chainId: Number(process.env.ZG_CHAIN_ID ?? (isMainnet ? 16661 : 16602)),
  rpcUrl: process.env.ZG_RPC_URL ?? (isMainnet ? "https://evmrpc.0g.ai" : "https://evmrpc-testnet.0g.ai"),
  storageIndexer:
    process.env.ZG_STORAGE_INDEXER ??
    (isMainnet ? "https://indexer-storage-turbo.0g.ai" : "https://indexer-storage-testnet-turbo.0g.ai"),
  explorerUrl: process.env.ZG_EXPLORER_URL ?? (isMainnet ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai"),
  storageExplorerUrl:
    process.env.ZG_STORAGE_EXPLORER_URL ?? (isMainnet ? "https://storagescan.0g.ai" : "https://storagescan-galileo.0g.ai"),
  privateKey: process.env.ZG_PRIVATE_KEY,
  registryContract: process.env.ZG_REGISTRY_CONTRACT,
  legacyRegistryContracts: legacyRegistrySource
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  registryFromBlock: Number(process.env.ZG_REGISTRY_FROM_BLOCK ?? (isMainnet ? 36938000 : 0)),
  computeApiKey: process.env.ZG_COMPUTE_API_KEY,
  computeBaseUrl: process.env.ZG_COMPUTE_BASE_URL ?? (isMainnet ? "https://router-api.0g.ai/v1" : "https://router-api-testnet.integratenetwork.work/v1"),
  computeModel: process.env.ZEROSCOUT_FULL_PLATFORM_MODEL ?? process.env.ZG_COMPUTE_MODEL ?? "glm-5.2",
  computeHelperModel: process.env.ZEROSCOUT_HELPER_MODEL ?? process.env.ZG_COMPUTE_HELPER_MODEL ?? "claude-fable-5",
  computeLpModel: process.env.ZEROSCOUT_LP_MODEL ?? process.env.ZG_COMPUTE_LP_MODEL ?? "claude-fable-5",
  computeLpVerifierModel: process.env.ZEROSCOUT_LP_VERIFIER_MODEL ?? process.env.ZG_COMPUTE_LP_VERIFIER_MODEL ?? "glm-5.2",
  computeVideoModel: process.env.ZEROSCOUT_HASHWATCH_MEDIA_MODEL ?? process.env.ZG_COMPUTE_VIDEO_MODEL ?? "qwen3-vl-30b",
  computeTrustMode: process.env.ZG_COMPUTE_TRUST_MODE ?? "verified",
  lpVerifierEnabled: process.env.ZEROSCOUT_LP_VERIFIER_ENABLED === "true",
  externalReviewersEnabled: process.env.ZEROSCOUT_ENABLE_EXTERNAL_REVIEWERS === "true",
  integrationSecret: process.env.ZEROSCOUT_INTEGRATION_SECRET,
  adminToken: process.env.ZEROSCOUT_ADMIN_TOKEN,
  treasuryAddress: process.env.ZEROSCOUT_TREASURY_ADDRESS,
  creditsPerOg: Number(process.env.ZEROSCOUT_CREDITS_PER_OG ?? 100),
  topUpScanBlocks: Number(process.env.ZEROSCOUT_TOPUP_SCAN_BLOCKS ?? 1500),
  databaseUrl: process.env.DATABASE_URL,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: process.env.OPENAI_BASE_URL,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openAiEvaluatorApiKey: process.env.OPENAI_EVALUATOR_API_KEY ?? process.env.OPENAI_API_KEY,
  openAiEvaluatorBaseUrl: process.env.OPENAI_EVALUATOR_BASE_URL ?? process.env.OPENAI_BASE_URL,
  openAiEvaluatorModel: process.env.OPENAI_EVALUATOR_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
  devStorageFallback: process.env.DEV_STORAGE_FALLBACK === "true",
  dataDir: process.env.DATA_DIR ?? "server/data"
};

export function publicConfig() {
  const has0gStorage = Boolean(config.privateKey);
  const has0gCompute = Boolean(config.computeApiKey);

  return {
    network: config.network,
    chainId: config.chainId,
    storageIndexer: config.storageIndexer,
    explorerUrl: config.explorerUrl,
    storageExplorerUrl: config.storageExplorerUrl,
    registryContract: config.registryContract,
    computeMode: has0gCompute ? "0G Compute Router" : config.openAiApiKey ? "OpenAI-compatible fallback" : "deterministic local scout fallback",
    computeModels: has0gCompute
      ? {
          helper: config.computeHelperModel,
          lpIntelligence: config.computeLpModel,
          lpVerifier: config.lpVerifierEnabled ? config.computeLpVerifierModel : undefined,
          videoScoring: config.computeVideoModel,
          fullPlatform: config.computeModel
        }
      : undefined,
    storageMode: has0gStorage ? `0G ${config.network}` : config.devStorageFallback ? "local dev fallback" : "not configured"
  };
}
