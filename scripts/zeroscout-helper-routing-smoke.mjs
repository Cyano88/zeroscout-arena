import assert from "node:assert/strict";
import { __testAiRouting } from "../server/src/services/ai.ts";

const compactSimple = __testAiRouting.compactHelperData({
  proofClass: "zeroscout_helper_context_guidance",
  service: "Hash PayLink Helper",
  action: "helper-chat-preflight",
  requestHash: "request-hash",
  refinementPolicy: "single-lane-short-refinement",
  requestedRefinementLane: "openai",
  fallbackOrder: ["openai", "0g-compute", "anthropic", "local"],
  request: {
    eventId: "event-id",
    question: "Hi",
    memorySummary: "User prefers to be called Shy.",
    memorySummaryHash: "memory-hash",
  },
});

const simpleRouting = __testAiRouting.helperProviderRouting(compactSimple);
assert.equal(simpleRouting.requestedLane, "openai");
assert.equal(simpleRouting.refinementPolicy, "single-lane-short-refinement");
assert.equal(simpleRouting.multiStack, false);
assert.deepEqual(simpleRouting.fallbackOrder, ["openai", "0g-compute", "anthropic"]);

const compactDeep = __testAiRouting.compactHelperData({
  proofClass: "zeroscout_helper_context_guidance",
  service: "Hash PayLink Helper",
  action: "helper-chat-preflight",
  requestHash: "request-hash",
  refinementPolicy: "deep-multi-stack-0g-anthropic-openai",
  requestedRefinementLane: "multi-stack",
  fallbackOrder: ["anthropic", "local"],
  request: {
    eventId: "event-id",
    question: "Research PolyDesk LP Scout x402 strategy",
    memorySummaryHash: "memory-hash",
  },
});

const deepRouting = __testAiRouting.helperProviderRouting(compactDeep);
assert.equal(deepRouting.requestedLane, "multi-stack");
assert.equal(deepRouting.multiStack, true);
assert.deepEqual(deepRouting.fallbackOrder, ["0g-compute", "openai", "anthropic"]);

const normalized = __testAiRouting.normalizeHelperFallbackOrder(["claude", "og", "gpt", "local"]);
assert.deepEqual(normalized, ["anthropic", "0g-compute", "openai"]);

console.log("zeroscout helper routing smoke ok");
