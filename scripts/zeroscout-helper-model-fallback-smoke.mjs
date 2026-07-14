import assert from "node:assert/strict";

process.env.ZG_COMPUTE_API_KEY = "test-0g-key";
process.env.ZG_COMPUTE_BASE_URL = "https://router-api.0g.test/v1";
process.env.ZEROSCOUT_HELPER_MODEL = "unavailable-text-model";
process.env.ZEROSCOUT_HELPER_MODEL_CANDIDATES = "compatible-text-model";
process.env.ZEROSCOUT_HELPER_MODEL_DISCOVERY = "false";
process.env.ZEROSCOUT_HELPER_ATTEMPT_TIMEOUT_MS = "1500";

const originalFetch = globalThis.fetch;
const attempted = [];

globalThis.fetch = async (_url, init = {}) => {
  const body = JSON.parse(String(init.body ?? "{}"));
  attempted.push(body.model);
  if (body.model === "unavailable-text-model") {
    return new Response(JSON.stringify({ error: { message: "model unavailable" } }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({
    id: "0g-test-completion",
    object: "chat.completion",
    created: 1,
    model: body.model,
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ suggestedAnswer: "Payment prompt enriched." }) } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

try {
  const { __testAiRouting } = await import("../server/src/services/ai.ts");
  assert.deepEqual(await __testAiRouting.resolveHelperComputeModels(), ["unavailable-text-model", "compatible-text-model"]);
  const result = await __testAiRouting.completeHelperGuidanceForLane("0g-compute", "Return payment JSON.");
  assert.equal(result.model, "compatible-text-model");
  assert.deepEqual(result.attemptedModels, ["unavailable-text-model", "compatible-text-model"]);
  assert.equal(result.parsed.suggestedAnswer, "Payment prompt enriched.");
  assert.ok(attempted.includes("unavailable-text-model"));
  assert.ok(attempted.includes("compatible-text-model"));
  console.log("zeroscout helper model fallback smoke ok");
} finally {
  globalThis.fetch = originalFetch;
}
