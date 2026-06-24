import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import solc from "solc";
import { ethers } from "ethers";

const rpcUrl = process.env.ZG_RPC_URL ?? "https://evmrpc.0g.ai";
const chainId = Number(process.env.ZG_CHAIN_ID ?? 16661);
const privateKey = process.env.ZG_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("Set ZG_PRIVATE_KEY before deploying the registry.");
}

const contractPath = path.join(process.cwd(), "contracts", "ZeroScoutRegistry.sol");
const source = await readFile(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "ZeroScoutRegistry.sol": { content: source }
  },
  settings: {
    evmVersion: "cancun",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"]
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: { severity: string; formattedMessage: string }[];
  contracts: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
};

const errors = output.errors?.filter((item) => item.severity === "error") ?? [];
if (errors.length > 0) {
  throw new Error(errors.map((item) => item.formattedMessage).join("\n"));
}

const compiled = output.contracts["ZeroScoutRegistry.sol"].ZeroScoutRegistry;
const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
const wallet = new ethers.Wallet(privateKey, provider);
const factory = new ethers.ContractFactory(compiled.abi, compiled.evm.bytecode.object, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();

const address = await contract.getAddress();
const tx = contract.deploymentTransaction();
const receipt = tx ? await provider.getTransactionReceipt(tx.hash) : null;

console.log("ZeroScoutRegistry deployed");
console.log("address:", address);
console.log("tx:", tx?.hash ?? "");
console.log("block:", receipt?.blockNumber ?? "");
console.log("env:");
console.log(`ZG_REGISTRY_CONTRACT=${address}`);
console.log(`ZG_REGISTRY_FROM_BLOCK=${receipt?.blockNumber ?? ""}`);
