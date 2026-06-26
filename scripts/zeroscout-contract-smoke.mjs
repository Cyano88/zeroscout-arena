import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const repo = process.cwd();
const port = String(19_000 + Math.floor(Math.random() * 20_000));
const dataDir = `server/data-smoke-${port}`;
const adminToken = "local-admin-token";
const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/src/index.ts"], {
  cwd: repo,
  env: {
    ...process.env,
    PORT: port,
    DATA_DIR: dataDir,
    DEV_STORAGE_FALLBACK: "true",
    ZEROSCOUT_ADMIN_TOKEN: adminToken,
    ZEROSCOUT_CREDITS_PER_OG: "100",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
child.stdout.on("data", (chunk) => {
  logs += String(chunk);
});
child.stderr.on("data", (chunk) => {
  logs += String(chunk);
});

async function request(path, init = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function assertStatus(result, status, label) {
  assert.equal(result.response.status, status, `${label}: ${JSON.stringify(result.body)}`);
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const { response } = await request("/api/health");
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`ZeroScout smoke server did not start. Logs:\n${logs}`);
}

try {
  await waitForServer();

  const created = await request("/api/admin/integration-keys", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Hash PayLink smoke",
      partner: "Hash PayLink",
      creditBalance: 20,
      allowedEndpoints: ["sponsorship-proof"],
      allowedAnalysisTypes: ["zeroscout-sponsored-action"],
      allowedProofClasses: ["zeroscout_sponsored_action"],
    }),
  });
  assertStatus(created, 201, "create scoped key");
  assert.match(created.body.key, /^zs_live_/);

  const sponsorshipBody = {
    analysisType: "zeroscout-sponsored-action",
    proofClass: "zeroscout_sponsored_action",
    service: "Hash PayLink Helper",
    action: "helper-chat-response",
    requestHash: "request-smoke",
    answerHash: "answer-smoke",
    sourceProof: { type: "helper_access_receipt", rootHash: "0xroot" },
    result: { answerHash: "answer-smoke", usageRemaining: 9 },
  };
  const first = await request("/api/integrations/sponsorship-proof", {
    method: "POST",
    headers: { authorization: `Bearer ${created.body.key}` },
    body: JSON.stringify(sponsorshipBody),
  });
  assertStatus(first, 201, "create sponsorship proof");
  assert.equal(first.body.proofClass, "zeroscout_sponsored_action");
  assert(first.body.proof?.contentHash);
  assert.equal(first.body.integration?.partner, "Hash PayLink");
  assert.equal(first.body.idempotentReplay, false);

  const replay = await request("/api/integrations/sponsorship-proof", {
    method: "POST",
    headers: { authorization: `Bearer ${created.body.key}` },
    body: JSON.stringify(sponsorshipBody),
  });
  assertStatus(replay, 200, "replay sponsorship proof");
  assert.equal(replay.body.id, first.body.id);
  assert.equal(replay.body.idempotentReplay, true);

  const blockedKey = await request("/api/admin/integration-keys", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Intelligence only smoke",
      partner: "Blocked platform",
      creditBalance: 20,
      allowedEndpoints: ["intelligence"],
    }),
  });
  assertStatus(blockedKey, 201, "create blocked key");
  const blocked = await request("/api/integrations/sponsorship-proof", {
    method: "POST",
    headers: { authorization: `Bearer ${blockedKey.body.key}` },
    body: JSON.stringify(sponsorshipBody),
  });
  assertStatus(blocked, 401, "blocked sponsorship proof");
  assert.match(blocked.body.error, /sponsorship-proof/);

  console.log("zeroscout contract smoke ok");
} finally {
  child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  await rm(join(repo, dataDir), { recursive: true, force: true });
}
