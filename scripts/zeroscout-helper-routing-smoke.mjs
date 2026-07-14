import assert from "node:assert/strict";
import { __testAiRouting } from "../server/src/services/ai.ts";

const compactSimple = __testAiRouting.compactHelperData({
  proofClass: "zeroscout_helper_context_guidance",
  service: "Hash PayLink Helper",
  action: "helper-chat-preflight",
  requestHash: "request-hash",
  refinementPolicy: "0g-compute-compatible-model-fallback",
  requestedRefinementLane: "og-compute",
  fallbackOrder: ["0g-compute"],
  modelRoutingPolicy: {
    owner: "zeroscout",
    task: "payment-assistance",
    lpEndpointsAllowed: false,
  },
  helperModeInstructions: [
    "Hash PayLink owns deterministic payment actions.",
    "Never use LP Scout endpoints in Payments mode.",
  ],
  request: {
    eventId: "event-id",
    helperMode: "payments",
    helperIntent: "payment-help",
    qualityMode: "standard",
    question: "Create a PayLink for Nana",
    memorySummary: "User prefers to be called Shy.",
    memorySummaryHash: "memory-hash",
  },
});

const simpleRouting = __testAiRouting.helperProviderRouting(compactSimple);
assert.equal(compactSimple.request.helperMode, "payments");
assert.equal(compactSimple.request.helperIntent, "payment-help");
assert.equal(compactSimple.modelRoutingPolicy.lpEndpointsAllowed, false);
assert.deepEqual(compactSimple.helperModeInstructions, [
  "Hash PayLink owns deterministic payment actions.",
  "Never use LP Scout endpoints in Payments mode.",
]);
assert.equal(simpleRouting.requestedLane, "og-compute");
assert.equal(simpleRouting.refinementPolicy, "0g-compute-compatible-model-fallback");
assert.equal(simpleRouting.multiStack, false);
assert.deepEqual(simpleRouting.fallbackOrder, ["0g-compute"]);

const compactDeep = __testAiRouting.compactHelperData({
  proofClass: "zeroscout_helper_context_guidance",
  service: "Hash PayLink Helper",
  action: "helper-chat-preflight",
  requestHash: "request-hash",
  refinementPolicy: "0g-compute-compatible-model-fallback",
  requestedRefinementLane: "og-compute",
  fallbackOrder: ["0g-compute"],
  request: {
    eventId: "event-id",
    question: "Research PolyDesk LP Scout x402 strategy",
    memorySummaryHash: "memory-hash",
  },
});

const deepRouting = __testAiRouting.helperProviderRouting(compactDeep);
assert.equal(deepRouting.requestedLane, "og-compute");
assert.equal(deepRouting.multiStack, false);
assert.deepEqual(deepRouting.fallbackOrder, ["0g-compute"]);

const normalized = __testAiRouting.normalizeHelperFallbackOrder(["claude", "og", "gpt", "local"]);
assert.deepEqual(normalized, ["0g-compute"]);

console.log("zeroscout helper routing smoke ok");
