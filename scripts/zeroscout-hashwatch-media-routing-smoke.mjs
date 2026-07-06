import assert from "node:assert/strict";
import { __testAiRouting } from "../server/src/services/ai.ts";

const topLevel = __testAiRouting.extractHashWatchMediaRequest({
  proofClass: "zeroscout_helper_context_guidance",
  mediaTask: "video-url-analysis",
  forceMediaInspection: true,
  requiredProvider: "qwen-vl",
  requiredModel: "Qwen/Qwen2.5-VL-72B-Instruct",
  mediaUrl: "https://youtu.be/mYSVSs33ZgE?si=5eumS_SNzXDnzZYK",
  request: {
    question: "Explain the HashWatch video in detail",
  },
});

assert.equal(topLevel.requested, true);
assert.equal(topLevel.mediaUrl, "https://youtu.be/mYSVSs33ZgE?si=5eumS_SNzXDnzZYK");
assert.equal(topLevel.source, "data.mediaUrl");
assert.equal(topLevel.requiredProvider, "qwen-vl");
assert.equal(topLevel.requiredModel, "Qwen/Qwen2.5-VL-72B-Instruct");

const nested = __testAiRouting.extractHashWatchMediaRequest({
  mediaInspection: {
    requested: true,
    mediaUrl: "https://example.com/video.mp4",
    requiredModel: "Qwen/Qwen2.5-VL-72B-Instruct",
  },
  request: {
    question: "Give me a frame by frame breakdown",
    hashpayStreamContext: {
      activeContent: {
        title: "A simple tutorial on how to create 3D animated Digital Art",
      },
    },
  },
});

assert.equal(nested.requested, true);
assert.equal(nested.mediaUrl, "https://example.com/video.mp4");
assert.equal(nested.source, "data.mediaInspection.mediaUrl");
assert.equal(nested.title, "A simple tutorial on how to create 3D animated Digital Art");

const activeContent = __testAiRouting.extractHashWatchMediaRequest({
  mediaRouting: {
    task: "video-url-analysis",
    requiredProvider: "qwen-vl",
  },
  request: {
    hashpayStreamContext: {
      activeContent: {
        unlockedContent: {
          videoUrl: "https://cdn.example.com/unlocked.mp4",
        },
      },
    },
  },
});

assert.equal(activeContent.requested, true);
assert.equal(activeContent.mediaUrl, "https://cdn.example.com/unlocked.mp4");
assert.equal(activeContent.source, "data.request.hashpayStreamContext.activeContent.unlockedContent.videoUrl");

const compact = __testAiRouting.compactHelperData({
  mediaTask: "video-url-analysis",
  mediaUrl: "https://youtu.be/mYSVSs33ZgE?si=5eumS_SNzXDnzZYK",
  requiredModel: "Qwen/Qwen2.5-VL-72B-Instruct",
  request: {
    question: "Analyze this HashWatch video",
  },
});

assert.deepEqual(compact.hashWatchMedia, {
  requested: true,
  mediaUrlPresent: true,
  title: "",
  requiredProvider: "qwen-vl",
  requiredModel: "Qwen/Qwen2.5-VL-72B-Instruct",
  source: "data.mediaUrl",
});

const normal = __testAiRouting.extractHashWatchMediaRequest({
  request: {
    question: "Hi Agent Hash",
  },
});

assert.equal(normal.requested, false);
assert.equal(normal.mediaUrl, "");

assert.equal(
  __testAiRouting.resolveHashWatchMediaModel("Qwen/Qwen2.5-VL-72B-Instruct"),
  "Qwen/Qwen2.5-VL-72B-Instruct",
);

console.log("zeroscout hashwatch media routing smoke ok");
