import OpenAI from "openai";
import { config } from "../config.js";
import type { AiHealthResponse, CampaignPack, ProjectCapsule, ProjectCapsuleInput, SurvivalDelta, VideoReview } from "../../../shared/types.js";

interface ScoutResult {
  aiProvider: string;
  scoutBrief: string;
  technicalSummary: string;
  proofAnalysis: string;
  scores: ProjectCapsule["scores"];
  risks: string[];
  nextRoundTasks: string[];
  campaignPack: CampaignPack;
  survivalDelta?: SurvivalDelta;
}

interface MatchupResult {
  aiProvider: string;
  summary: string;
  strongerProof: string;
  clearerDemo: string;
  strongerPublicVoteCase: string;
  risksForA: string[];
  risksForB: string[];
  nextMoveForA: string;
  nextMoveForB: string;
}

type VideoReviewResult = Pick<VideoReview, "reviewMode" | "aiProvider" | "summary" | "proofFlowObserved" | "demoClarityNotes" | "strongestMoments" | "missingProofMoments" | "recommendedCuts">;

export interface PlatformVideoScoreResult {
  aiProvider: string;
  score: number;
  maxScore: 10;
  recommendation: "approve" | "review" | "reject";
  summary: string;
  rubric: {
    relevance: number;
    clarity: number;
    effort: number;
    safety: number;
  };
  flags: string[];
  suggestedFeedback: string;
}

export interface CustomIntelligenceInput {
  partner: string;
  productType: string;
  analysisType: string;
  objective: string;
  outputStyle: string;
  data: unknown;
  includeClaudeReview?: boolean;
  includeOpenAiReview?: boolean;
}

export interface CustomIntelligenceResult {
  aiProvider: string;
  intelligenceScore: number;
  confidence: number;
  summary: string;
  signals: string[];
  riskFlags: string[];
  recommendedActions: string[];
  dataGaps: string[];
  suggestedVisuals: string[];
  disclaimer: string;
  claudeReview?: {
    provider: string;
    intelligenceRating: number;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  };
  openAiReview?: {
    provider: string;
    intelligenceRating: number;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  };
}

export async function generateScout(input: ProjectCapsuleInput, previous?: ProjectCapsule): Promise<ScoutResult> {
  const prompt = scoutPrompt(input, previous);
  const ai = getAiClient();

  if (ai) {
    try {
      const content = await completeJson(ai, [
        {
          role: "system",
          content:
            "You are ZeroScout, a neutral AI scouting agent for the 0G Zero Cup. Return strict JSON only. Use 'AI Scout Signal' language, never official judging language."
        },
        { role: "user", content: prompt }
      ]);
      if (content) {
        return normalizeScout(parseJsonObject(content), ai.label, input, previous);
      }
    } catch (error) {
      console.warn("AI provider failed, using deterministic scout fallback:", error);
    }
  }

  return deterministicScout(input, previous);
}

export async function generateCustomIntelligence(input: CustomIntelligenceInput): Promise<CustomIntelligenceResult> {
  assertCustomIntelligenceInput(input);
  const ai = getAiClient();
  if (!ai) {
    throw new Error("0G Compute or OpenAI-compatible AI is not configured for custom intelligence.");
  }

  const prompt = `Create a structured ZeroScout intelligence brief for an external platform.

Partner: ${input.partner}
Product type: ${input.productType}
Analysis type: ${input.analysisType}
Objective: ${input.objective}
Output style: ${input.outputStyle}

Supplied partner data:
${JSON.stringify(input.data ?? {}).slice(0, 18000)}

Return strict JSON with keys:
intelligenceScore number 0-100,
confidence number 0-100,
summary string,
signals array,
riskFlags array,
recommendedActions array,
dataGaps array,
suggestedVisuals array,
disclaimer string.

Rules:
- Be practical and specific to the supplied data.
- Do not invent live market data, prices, liquidity, users, volume, or performance.
- If the request is about markets, LPs, grants, or trading, frame this as an intelligence signal, not financial advice.
- If the data is thin, say exactly what is missing instead of pretending certainty.
- Make the output useful for a real product UI or internal operator dashboard.`;

  const content = await completeJson(ai, [
    {
      role: "system",
      content: "You are ZeroScout's custom intelligence agent for partner platforms. Return strict JSON only. Never fabricate data."
    },
    { role: "user", content: prompt }
  ]);
  const parsed = parseJsonObject(content ?? "{}");
  const result: CustomIntelligenceResult = {
    aiProvider: ai.label,
    intelligenceScore: clampScore(parsed.intelligenceScore, 100, 62),
    confidence: clampScore(parsed.confidence, 100, 55),
    summary: text(parsed.summary, "ZeroScout generated a custom intelligence brief from the supplied partner data."),
    signals: list(parsed.signals, ["The supplied data was accepted for structured analysis."]),
    riskFlags: list(parsed.riskFlags, ["Add richer source data before relying on this signal for decisions."]),
    recommendedActions: list(parsed.recommendedActions, ["Add more recent, structured partner data and rerun the analysis."]),
    dataGaps: list(parsed.dataGaps, ["No live external data was fetched by ZeroScout for this request."]),
    suggestedVisuals: list(parsed.suggestedVisuals, ["Show score, key signals, risk flags, and proof root in the product UI."]),
    disclaimer: text(parsed.disclaimer, "This is an AI intelligence signal generated from supplied data. It is not financial, legal, or investment advice.")
  };

  if (input.includeClaudeReview && config.anthropicApiKey) {
    result.claudeReview = await reviewCustomIntelligenceWithClaude(input, result);
  }

  if (input.includeOpenAiReview && config.openAiEvaluatorApiKey) {
    result.openAiReview = await reviewCustomIntelligenceWithOpenAi(input, result);
  }

  return result;
}

export async function checkAiHealth(): Promise<AiHealthResponse> {
  const ai = getAiClient();
  if (!ai) {
    return {
      configured: false,
      ok: false,
      provider: "deterministic local scout fallback",
      error: "No 0G Compute or OpenAI-compatible key is configured."
    };
  }

  try {
    const content = await completeJson(ai, [
      { role: "system", content: "Return strict JSON only." },
      { role: "user", content: "Return {\"ok\":true,\"service\":\"zeroscout-ai-health\"}." }
    ]);
    const parsed = content ? parseJsonObject(content) : {};
    return {
      configured: true,
      ok: parsed.ok === true,
      provider: ai.label,
      model: ai.model,
      trustMode: config.computeApiKey ? config.computeTrustMode : undefined
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      provider: ai.label,
      model: ai.model,
      trustMode: config.computeApiKey ? config.computeTrustMode : undefined,
      error: sanitizeAiError(error)
    };
  }
}

export async function generateMatchup(a: ProjectCapsule, b: ProjectCapsule): Promise<MatchupResult> {
  const ai = getAiClient();
  const prompt = `Compare these two ZeroScout Project Passports for a neutral builder-program scouting brief.

Project A: ${JSON.stringify(summaryForAi(a))}
Project B: ${JSON.stringify(summaryForAi(b))}

Return JSON with keys summary, strongerProof, clearerDemo, strongerPublicVoteCase, risksForA, risksForB, nextMoveForA, nextMoveForB. Do not declare an official winner.`;

  if (ai) {
    try {
      const content = await completeJson(ai, [
        { role: "system", content: "Return strict JSON only. This is an AI scouting signal, not official judging." },
        { role: "user", content: prompt }
      ]);
      if (content) {
          const parsed = parseJsonObject(content) as Partial<MatchupResult>;
        return {
          aiProvider: ai.label,
          summary: text(parsed.summary, `${a.projectName} and ${b.projectName} show different strengths for their next campaign checkpoint.`),
          strongerProof: text(parsed.strongerProof, `${higher(a.scores.ogNativeDepth, b.scores.ogNativeDepth, a.projectName, b.projectName, "Both capsules")} show the clearer 0G proof signal today.`),
          clearerDemo: text(parsed.clearerDemo, `${higher(a.scores.demoClarity, b.scores.demoClarity, a.projectName, b.projectName, "Both capsules")} show the clearer demo signal.`),
          strongerPublicVoteCase: text(parsed.strongerPublicVoteCase, `${higher(a.scores.communityShareability, b.scores.communityShareability, a.projectName, b.projectName, "Both capsules")} show the stronger campaign signal.`),
          risksForA: list(parsed.risksForA, [`${a.projectName} should make the 0G proof path impossible to miss.`]),
          risksForB: list(parsed.risksForB, [`${b.projectName} should make the 0G proof path impossible to miss.`]),
          nextMoveForA: text(parsed.nextMoveForA, "Publish one sharper proof walkthrough before the next cut."),
          nextMoveForB: text(parsed.nextMoveForB, "Publish one sharper proof walkthrough before the next cut.")
        };
      }
    } catch (error) {
      console.warn("AI matchup failed, using deterministic matchup:", error);
    }
  }

  return {
    aiProvider: "deterministic local scout fallback",
    summary: `${a.projectName} and ${b.projectName} are compared as proof capsules, not official competitors.`,
    strongerProof: `${higher(a.scores.ogNativeDepth, b.scores.ogNativeDepth, a.projectName, b.projectName, "Both capsules")} show the stronger 0G-native depth signal.`,
    clearerDemo: `${higher(a.scores.demoClarity, b.scores.demoClarity, a.projectName, b.projectName, "Both capsules")} show the clearer demo signal.`,
    strongerPublicVoteCase: `${higher(a.scores.communityShareability, b.scores.communityShareability, a.projectName, b.projectName, "Both capsules")} show the stronger community campaign signal.`,
    risksForA: [`${a.projectName} must show proof, demo value, and next-step clarity in one public page.`],
    risksForB: [`${b.projectName} must show proof, demo value, and next-step clarity in one public page.`],
    nextMoveForA: "Record a short proof walkthrough and pin the 0G root on the capsule page.",
    nextMoveForB: "Record a short proof walkthrough and pin the 0G root on the capsule page."
  };
}

export async function generateVideoReview(capsule: ProjectCapsule): Promise<VideoReviewResult> {
  if (!capsule.videoDemoUrl) {
    throw new Error("Add a video walkthrough URL before requesting a video review.");
  }

  const ai = getVideoAiClient();
  if (!ai) {
    throw new Error("0G Compute Router is not configured for video review.");
  }

  if (isProviderShareLink(capsule.videoDemoUrl)) {
    return generateWalkthroughLinkReview(
      capsule,
      ai,
      "YouTube and Loom share links are reviewed as provider links. Raw frame-level video analysis requires a direct video file URL that exposes Content-Length."
    );
  }

  const videoInputUrl = await resolveVideoInputUrl(capsule.videoDemoUrl);
  const prompt = `Review this builder demo video for a ZeroScout Project Passport.

Project:
${JSON.stringify(summaryForAi(capsule))}

Focus only on what is visible or reasonably inferable from the video. Return JSON with keys:
summary, proofFlowObserved, demoClarityNotes array, strongestMoments array, missingProofMoments array, recommendedCuts array.

Use "video review signal", not official judging language. If the video cannot be read, say that clearly in the JSON.`;

  const messages = [
    {
      role: "system",
      content: "You are ZeroScout's video review agent. Return strict JSON only. Do not claim official judging authority."
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "video_url", video_url: { url: videoInputUrl } }
      ]
    }
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  let parsed: Record<string, unknown>;
  try {
    const content = await completeJson(ai, messages);
    parsed = parseJsonObject(content ?? "{}");
  } catch (error) {
    const reason = sanitizeAiError(error);
    if (!shouldUseWalkthroughFallback(reason)) throw error;
    return generateWalkthroughLinkReview(capsule, ai, reason);
  }

  return {
    reviewMode: "video",
    aiProvider: ai.label,
    summary: text(parsed.summary, "The video review could not extract a detailed summary."),
    proofFlowObserved: text(parsed.proofFlowObserved, "The review did not identify a clear proof flow in the video."),
    demoClarityNotes: list(parsed.demoClarityNotes, ["Show the product action, 0G proof, and public passport in one continuous path."]),
    strongestMoments: list(parsed.strongestMoments, ["The video link was submitted for review."]),
    missingProofMoments: list(parsed.missingProofMoments, ["Make the storage root, registry tx, or Compute provider visible in the walkthrough."]),
    recommendedCuts: list(parsed.recommendedCuts, ["Keep the walkthrough under two minutes and lead with the proof outcome."])
  };
}

export async function generateUploadedVideoReview(capsule: ProjectCapsule, videoUrl: string): Promise<VideoReviewResult> {
  const ai = getVideoAiClient();
  if (!ai) {
    throw new Error("0G Compute Router is not configured for video review.");
  }

  const prompt = `Review this uploaded builder demo video for a ZeroScout Project Passport.

Project:
${JSON.stringify(summaryForAi(capsule))}

Focus only on what is visible or reasonably inferable from the video. Return JSON with keys:
summary, proofFlowObserved, demoClarityNotes array, strongestMoments array, missingProofMoments array, recommendedCuts array.

Use "video review signal", not official judging language.`;

  const content = await completeJson(ai, [
    {
      role: "system",
      content: "You are ZeroScout's video review agent. Return strict JSON only. Do not claim official judging authority."
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "video_url", video_url: { url: videoUrl } }
      ]
    }
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]);
  const parsed = parseJsonObject(content ?? "{}");
  return {
    reviewMode: "video",
    aiProvider: ai.label,
    summary: text(parsed.summary, "The uploaded video review could not extract a detailed summary."),
    proofFlowObserved: text(parsed.proofFlowObserved, "The review did not identify a clear proof flow in the uploaded video."),
    demoClarityNotes: list(parsed.demoClarityNotes, ["Show the product action, 0G proof, and public passport in one continuous path."]),
    strongestMoments: list(parsed.strongestMoments, ["The uploaded video was submitted for review."]),
    missingProofMoments: list(parsed.missingProofMoments, ["Make the storage root, registry tx, or Compute provider visible in the walkthrough."]),
    recommendedCuts: list(parsed.recommendedCuts, ["Keep the walkthrough under two minutes and lead with the proof outcome."])
  };
}

export async function generatePlatformVideoScore(input: {
  videoUrl: string;
  platform: string;
  program: string;
  projectName: string;
  prompt?: string;
}): Promise<PlatformVideoScoreResult> {
  const ai = getVideoAiClient();
  if (!ai) {
    throw new Error("0G Compute Router is not configured for video scoring.");
  }

  const prompt = `Score this uploaded campaign video for a platform integration.

Platform: ${input.platform}
Program/campaign: ${input.program}
Target project/community: ${input.projectName}
Extra scoring context: ${input.prompt || "none"}

Rubric, total 10 points:
- relevance, 0-4: video is actually about the target project/community/campaign.
- clarity, 0-3: viewer can quickly understand the user's point or contribution.
- effort, 0-2: video shows original effort, not spam or unrelated recycled content.
- safety, 0-1: video appears safe for public campaign review.

Return strict JSON with keys:
score number 0-10,
recommendation one of approve/review/reject,
summary string,
rubric { relevance, clarity, effort, safety },
flags array,
suggestedFeedback string.

Be strict. If the video is unrelated, score low even if it is polished.`;

  const content = await completeJson(ai, [
    {
      role: "system",
      content: "You are ZeroScout's platform video scoring agent. Return strict JSON only. This is an automated campaign-readiness signal, not an official human decision."
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "video_url", video_url: { url: input.videoUrl } }
      ]
    }
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]);
  const parsed = parseJsonObject(content ?? "{}");
  const rubric = parsed.rubric && typeof parsed.rubric === "object" ? parsed.rubric as Record<string, unknown> : {};
  const relevance = clampScore(rubric.relevance, 4);
  const clarity = clampScore(rubric.clarity, 3);
  const effort = clampScore(rubric.effort, 2);
  const safety = clampScore(rubric.safety, 1);
  const summed = relevance + clarity + effort + safety;
  return {
    aiProvider: ai.label,
    score: clampScore(parsed.score, 10, summed),
    maxScore: 10,
    recommendation: normalizeRecommendation(parsed.recommendation),
    summary: text(parsed.summary, "0G Compute reviewed the uploaded campaign video."),
    rubric: { relevance, clarity, effort, safety },
    flags: list(parsed.flags, []),
    suggestedFeedback: text(parsed.suggestedFeedback, "Make the video clearly about the target project and show original effort.")
  };
}

async function resolveVideoInputUrl(videoUrl: string): Promise<string> {
  const host = new URL(videoUrl).hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "loom.com") return videoUrl;

  const response = await fetch(videoUrl, { headers: { "User-Agent": "ZeroScout-Arena" } });
  if (!response.ok) throw new Error("Could not load the Loom page for video review.");
  const html = await response.text();
  const match = html.match(/"nullableRawCdnUrl\(\{\\"acceptableMimes\\":\[\\"M3U8\\"\].*?\)":\{"__typename":"CloudfrontSignedUrlPayload","url":"([^"]+)"/);
  const signedUrl = match?.[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  if (!signedUrl) throw new Error("Could not resolve a Loom video stream for 0G review.");
  return signedUrl;
}

async function generateWalkthroughLinkReview(capsule: ProjectCapsule, ai: { client: OpenAI; model: string; label: string }, reason: string): Promise<VideoReviewResult> {
  const context = await buildWalkthroughContext(capsule.videoDemoUrl ?? "");
  const prompt = `Create a ZeroScout walkthrough review for this Project Passport.

The submitted video provider link could not be passed as raw multimodal video because the provider URL did not expose the required file metadata to the 0G video endpoint.
Do not claim frame-level video analysis. Review only the Project Passport context, submitted walkthrough link, and any provider metadata/transcript below.

Project:
${JSON.stringify(summaryForAi(capsule))}

Walkthrough context:
${JSON.stringify(context)}

Provider limitation:
${reason}

Return JSON with keys:
summary, proofFlowObserved, demoClarityNotes array, strongestMoments array, missingProofMoments array, recommendedCuts array.

Use "walkthrough review signal", not official judging language.`;

  const content = await completeJson(ai, [
    { role: "system", content: "You are ZeroScout's walkthrough review agent. Return strict JSON only. Be explicit when review is based on link metadata or transcript rather than raw video frames." },
    { role: "user", content: prompt }
  ]);
  const parsed = parseJsonObject(content ?? "{}");
  return {
    reviewMode: "walkthrough-link",
    aiProvider: `${ai.label} walkthrough review`,
    summary: text(parsed.summary, "0G Compute reviewed the submitted walkthrough context, but raw video ingestion was blocked by the provider URL."),
    proofFlowObserved: text(parsed.proofFlowObserved, "The review is based on the Project Passport and walkthrough link context, not frame-level video analysis."),
    demoClarityNotes: list(parsed.demoClarityNotes, ["Use a direct video file with Content-Length for frame-level 0G video review, or keep the Loom/YouTube link as a walkthrough reference."]),
    strongestMoments: list(parsed.strongestMoments, ["The submitted walkthrough link is attached to the Project Passport."]),
    missingProofMoments: list(parsed.missingProofMoments, ["Make storage root, registry transaction, and Compute provider visible in the walkthrough."]),
    recommendedCuts: list(parsed.recommendedCuts, ["Lead with the proof outcome, then show the create/update flow, then show verification."])
  };
}

async function buildWalkthroughContext(videoUrl: string): Promise<Record<string, unknown>> {
  if (!videoUrl) return {};
  const url = new URL(videoUrl);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "loom.com") {
    return readLoomContext(videoUrl);
  }
  if (host === "youtube.com" || host === "youtu.be") {
    return readYouTubeContext(videoUrl);
  }
  return { url: videoUrl, provider: host };
}

async function readLoomContext(videoUrl: string): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(videoUrl, { headers: { "User-Agent": "ZeroScout-Arena" } });
    if (!response.ok) return { url: videoUrl, provider: "loom", fetchStatus: response.status };
    const html = await response.text();
    return {
      url: videoUrl,
      provider: "loom",
      title: readMeta(html, "og:title") ?? readTitle(html),
      description: readMeta(html, "og:description"),
      transcriptSignals: uniqueMatches(html, /"text":"([^"]{8,280})"/g).slice(0, 24)
    };
  } catch (error) {
    return { url: videoUrl, provider: "loom", error: sanitizeAiError(error) };
  }
}

async function readYouTubeContext(videoUrl: string): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, { headers: { "User-Agent": "ZeroScout-Arena" } });
    if (!response.ok) return { url: videoUrl, provider: "youtube", fetchStatus: response.status };
    const data = await response.json() as Record<string, unknown>;
    return {
      url: videoUrl,
      provider: "youtube",
      title: data.title,
      authorName: data.author_name
    };
  } catch (error) {
    return { url: videoUrl, provider: "youtube", error: sanitizeAiError(error) };
  }
}

function shouldUseWalkthroughFallback(reason: string): boolean {
  return /Missing Content-Length|Invalid video file|multimodal url|video/i.test(reason);
}

function isProviderShareLink(videoUrl: string): boolean {
  const host = new URL(videoUrl).hostname.replace(/^www\./, "").toLowerCase();
  return host === "youtube.com" || host === "youtu.be" || host === "loom.com";
}

function readMeta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function readTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function uniqueMatches(html: string, pattern: RegExp): string[] {
  const values = [...html.matchAll(pattern)]
    .map((match) => decodeHtml(match[1] ?? "").replace(/\\"/g, "\"").trim())
    .filter((value) => value.length > 0 && !value.includes("__typename"));
  return [...new Set(values)];
}

function decodeHtml(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAiClient(): { client: OpenAI; model: string; label: string } | undefined {
  if (config.computeApiKey) {
    return {
      client: new OpenAI({
        apiKey: config.computeApiKey,
        baseURL: config.computeBaseUrl,
        defaultHeaders: computeHeaders()
      }),
      model: config.computeModel,
      label: `0G Compute Router (${config.computeModel})`
    };
  }

  if (config.openAiApiKey) {
    return {
      client: new OpenAI({ apiKey: config.openAiApiKey, baseURL: config.openAiBaseUrl }),
      model: config.openAiModel,
      label: `OpenAI-compatible fallback (${config.openAiModel})`
    };
  }

  return undefined;
}

function getVideoAiClient(): { client: OpenAI; model: string; label: string } | undefined {
  if (!config.computeApiKey) return undefined;
  return {
    client: new OpenAI({
      apiKey: config.computeApiKey,
      baseURL: config.computeBaseUrl,
      defaultHeaders: computeHeaders()
    }),
    model: config.computeVideoModel,
    label: `0G Compute Router video (${config.computeVideoModel})`
  };
}

function computeHeaders(): Record<string, string> | undefined {
  if (!config.computeTrustMode || config.computeTrustMode === "default") return undefined;
  return { "X-0G-Provider-Trust-Mode": config.computeTrustMode };
}

async function reviewCustomIntelligenceWithClaude(
  input: CustomIntelligenceInput,
  result: CustomIntelligenceResult
): Promise<NonNullable<CustomIntelligenceResult["claudeReview"]>> {
  const prompt = `Rate this ZeroScout custom intelligence output for real platform usefulness.

Original request:
${JSON.stringify({
  partner: input.partner,
  productType: input.productType,
  analysisType: input.analysisType,
  objective: input.objective,
  outputStyle: input.outputStyle
})}

ZeroScout output:
${JSON.stringify(result)}

Return strict JSON with keys:
intelligenceRating number 0-10,
strengths array,
gaps array,
recommendation string.

Focus on whether this would be useful inside an institutional product. Do not add new facts.`;

  const content = await completeClaudeJson(prompt);
  const parsed = parseJsonObject(content);
  return {
    provider: `Claude API (${config.anthropicModel})`,
    intelligenceRating: clampScore(parsed.intelligenceRating, 10, 7),
    strengths: list(parsed.strengths, ["The output is structured and product-facing."]),
    gaps: list(parsed.gaps, ["The partner should supply richer data for stronger analysis."]),
    recommendation: text(parsed.recommendation, "Use this as a second-opinion quality check before showing the intelligence module to users.")
  };
}

async function reviewCustomIntelligenceWithOpenAi(
  input: CustomIntelligenceInput,
  result: CustomIntelligenceResult
): Promise<NonNullable<CustomIntelligenceResult["openAiReview"]>> {
  const client = new OpenAI({
    apiKey: config.openAiEvaluatorApiKey,
    baseURL: config.openAiEvaluatorBaseUrl
  });
  const content = await completeJson({ client, model: config.openAiEvaluatorModel }, [
    {
      role: "system",
      content: "Return strict JSON only. Rate the usefulness of the supplied intelligence output. Do not add facts."
    },
    {
      role: "user",
      content: `Rate this ZeroScout custom intelligence output for product usefulness.

Original request:
${JSON.stringify({
  partner: input.partner,
  productType: input.productType,
  analysisType: input.analysisType,
  objective: input.objective,
  outputStyle: input.outputStyle
})}

ZeroScout output:
${JSON.stringify(result)}

Return strict JSON with keys:
intelligenceRating number 0-10,
strengths array,
gaps array,
recommendation string.

Focus on product usefulness, data honesty, and whether a partner could show this in a real dashboard.`
    }
  ]);
  const parsed = parseJsonObject(content ?? "{}");
  return {
    provider: `OpenAI evaluator (${config.openAiEvaluatorModel})`,
    intelligenceRating: clampScore(parsed.intelligenceRating, 10, 7),
    strengths: list(parsed.strengths, ["The output is structured for a real product surface."]),
    gaps: list(parsed.gaps, ["The partner should provide richer data before relying on the signal."]),
    recommendation: text(parsed.recommendation, "Use this evaluator as a third opinion alongside 0G Compute and Claude when configured.")
  };
}

async function completeClaudeJson(prompt: string): Promise<string> {
  if (!config.anthropicApiKey) throw new Error("Claude API is not configured. Set ANTHROPIC_API_KEY.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 1200,
      temperature: 0.2,
      system: "Return strict JSON only. Do not wrap the response in Markdown.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Claude API request failed: ${response.status} ${body.slice(0, 180)}`);
  }
  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((item) => item.type === "text" && item.text);
  if (!textBlock?.text) throw new Error("Claude API returned no text content.");
  return textBlock.text;
}

function sanitizeAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 280);
}

function assertCustomIntelligenceInput(input: CustomIntelligenceInput): void {
  const serialized = JSON.stringify(input.data ?? {});
  if (serialized.length > 120_000) {
    throw new Error("Custom intelligence data is too large. Send summarized data under 120 KB.");
  }
  if (!input.productType || !input.analysisType) {
    throw new Error("productType and analysisType are required.");
  }
}

async function completeJson(ai: { client: OpenAI; model: string }, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string | undefined> {
  try {
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages
    });
    return response.choices[0]?.message?.content ?? undefined;
  } catch (firstError) {
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      temperature: 0.35,
      messages: [
        ...messages,
        {
          role: "user",
          content: "Important: return only valid JSON. Do not wrap it in Markdown."
        }
      ]
    });
    const content = response.choices[0]?.message?.content ?? undefined;
    if (!content) throw firstError;
    return content;
  }
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("AI provider returned non-JSON content");
  }
}

function scoutPrompt(input: ProjectCapsuleInput, previous?: ProjectCapsule): string {
  return `Create a real-world ZeroScout Project Passport intelligence brief for this builder.

Product context: ZeroScout is a plug-and-play proof layer for builder programs. Hackathons, cohorts, grants, accelerators, demo days, and universities use it to collect AI-reviewed project progress and store canonical proof capsules on 0G.

If campaignId is zero-cup, use Zero Cup context: 0G Global Vibe Coding Tournament, six-round knockout. Teams must build AI-native apps, agents, companions, or games using 0G. 0G must do real work. Teams improve and resubmit between cuts.

If campaignId is grail-builders-university, use cohort context: students submit checkpoint proof for mentors, sponsors, ecosystem leads, and agents. Focus on what changed, what needs review, and what help is needed.

Current submission:
${JSON.stringify(input)}

Previous capsule for survival delta:
${previous ? JSON.stringify(summaryForAi(previous)) : "none"}

Return JSON with keys:
scoutBrief, technicalSummary, proofAnalysis,
scores { ogNativeDepth, aiNativeUsefulness, demoClarity, productPolish, communityShareability, total },
risks array, nextRoundTasks array,
campaignPack { voterPitch, xPost, telegramPost, sponsorSummary },
survivalDelta optional { improved, stillWeak, ogUsageDelta, demoClarityDelta, communityReadinessDelta, topPriorities }.

Make it specific, practical, and useful to a builder trying to improve before the next checkpoint. Use "readiness signal" and "AI Scout Signal", never official judge score.`;
}

function normalizeScout(raw: Partial<ScoutResult>, provider: string, input: ProjectCapsuleInput, previous?: ProjectCapsule): ScoutResult {
  const scores = normalizeScores(raw.scores, input);
  const delta = previous
    ? {
        previousCapsuleId: previous.id,
        improved: list(raw.survivalDelta?.improved, ["The new capsule is more explicit about the current round and campaign use case."]),
        stillWeak: list(raw.survivalDelta?.stillWeak, ["The team still needs a sharper proof walkthrough for voters and reviewers."]),
        ogUsageDelta: text(raw.survivalDelta?.ogUsageDelta, "0G usage should move from claim to visible proof in the demo."),
        demoClarityDelta: text(raw.survivalDelta?.demoClarityDelta, "The demo needs a shorter path from landing to proof."),
        communityReadinessDelta: text(raw.survivalDelta?.communityReadinessDelta, "Campaign copy is stronger when it ties proof to voter value."),
        topPriorities: list(raw.survivalDelta?.topPriorities, ["Ship proof walkthrough", "Make root hash visible", "Publish voter pitch"])
      }
    : undefined;
  const checkpoint = input.checkpointLabel ?? input.round;
  const campaignName = input.campaignName ?? "builder program";

  return {
    aiProvider: provider,
    scoutBrief: text(raw.scoutBrief, `${input.projectName} is positioned as a ${input.stage} project in ${campaignName}. The next checkpoint should make the 0G proof path visible and useful.`),
    technicalSummary: text(raw.technicalSummary, `${input.projectName} connects ${input.repoUrl} and ${input.demoUrl} into a public project checkpoint for ${checkpoint}.`),
    proofAnalysis: text(raw.proofAnalysis, `The submitted 0G claims must be visible in the demo and backed by storage, compute, or chain proof.`),
    scores,
    risks: list(raw.risks, ["0G integration may read as a bolt-on unless proof is shown directly in the user flow."]),
    nextRoundTasks: list(raw.nextRoundTasks, ["Add a public proof walkthrough", "Tighten the demo path", "Prepare community voting copy"]),
    campaignPack: {
      voterPitch: text(raw.campaignPack?.voterPitch, `${input.projectName} gives reviewers, mentors, sponsors, and community members a clear build to inspect, verify, and share.`),
      xPost: text(raw.campaignPack?.xPost, `We just published our ${checkpoint} Project Passport for ${input.projectName} on ZeroScout.`),
      telegramPost: text(raw.campaignPack?.telegramPost, `${input.projectName} has a new ZeroScout proof checkpoint. Review the profile, demo, 0G proof, and next steps.`),
      sponsorSummary: text(raw.campaignPack?.sponsorSummary, `${input.projectName} is a ${input.stage} project with a public repo, demo, and 0G usage claims ready for inspection.`)
    },
    survivalDelta: delta
  };
}

function deterministicScout(input: ProjectCapsuleInput, previous?: ProjectCapsule): ScoutResult {
  const scores = normalizeScores(undefined, input);
  const checkpoint = input.checkpointLabel ?? input.round;
  const campaignName = input.campaignName ?? "builder program";
  return normalizeScout(
    {
      scoutBrief: `${input.projectName} is a ${checkpoint} project from ${input.teamName} in ${campaignName}. The scout signal is strongest when the demo makes the proof path visible in the first minute.`,
      technicalSummary: `${input.projectName} links a public repo and demo into a checkpoint snapshot. The product claim is: ${input.tagline}`,
      proofAnalysis: `0G usage claim: ${input.ogUsageClaims}. The next credibility step is to show the exact storage, compute, or chain action inside the live flow.`,
      scores,
      risks: [
        "Reviewers may miss the 0G work if the proof appears only in docs.",
        "Community voters need a shorter explanation than judges.",
        "The repo and demo must match the public capsule claims."
      ],
      nextRoundTasks: [
        "Add a one-click proof inspector to the public page.",
        "Record a 60-second demo that shows the 0G action directly.",
        "Pin the next checkpoint and top three upgrade tasks on the passport."
      ],
      campaignPack: {
        voterPitch: `${input.projectName} is building in public. Inspect the demo, verify the proof capsule, and track how the team improves before the next checkpoint.`,
        xPost: `New ZeroScout Project Passport: ${input.projectName} by ${input.teamName}. Scout signal, 0G proof trail, and next checkpoint plan are live. ${input.demoUrl}`,
        telegramPost: `${input.projectName} just published a ZeroScout checkpoint for ${checkpoint}. The passport shows what works, how 0G is used, and what ships next.`,
        sponsorSummary: `${input.teamName} is shipping ${input.projectName}, a ${input.stage} project with public repo, demo, and a 0G proof-focused improvement path.`
      }
    },
    "deterministic local scout fallback",
    input,
    previous
  );
}

function normalizeScores(raw: Partial<ProjectCapsule["scores"]> | undefined, input: ProjectCapsuleInput): ProjectCapsule["scores"] {
  const baseline = baselineScores(input);
  const og = scoreWithFloor(raw?.ogNativeDepth, baseline.ogNativeDepth, 35);
  const ai = scoreWithFloor(raw?.aiNativeUsefulness, baseline.aiNativeUsefulness, 25);
  const demo = scoreWithFloor(raw?.demoClarity, baseline.demoClarity, 15);
  const polish = scoreWithFloor(raw?.productPolish, baseline.productPolish, 15);
  const community = scoreWithFloor(raw?.communityShareability, baseline.communityShareability, 10);
  return {
    ogNativeDepth: og,
    aiNativeUsefulness: ai,
    demoClarity: demo,
    productPolish: polish,
    communityShareability: community,
    total: clamp(og + ai + demo + polish + community, 0, 100)
  };
}

function baselineScores(input: ProjectCapsuleInput): ProjectCapsule["scores"] {
  const combined = `${input.description} ${input.ogUsageClaims} ${input.pitchNotes ?? ""}`.toLowerCase();
  const hasStorage = combined.includes("storage");
  const hasCompute = combined.includes("compute");
  const hasChain = combined.includes("chain") || combined.includes("registry") || combined.includes("contract");
  const hasProof = combined.includes("proof") || combined.includes("verify") || combined.includes("hash") || combined.includes("root");
  const hasUsers = combined.includes("builder") || combined.includes("cohort") || combined.includes("hackathon") || combined.includes("grant") || combined.includes("university");
  const ogNativeDepth = clamp(14 + Number(hasStorage) * 6 + Number(hasCompute) * 5 + Number(hasChain) * 5 + Number(hasProof) * 3, 0, 35);
  const aiNativeUsefulness = clamp(12 + Number(hasCompute) * 4 + Number(combined.includes("ai")) * 3 + Number(hasUsers) * 3, 0, 25);
  const demoClarity = clamp(input.demoUrl ? 11 : 5, 0, 15);
  const productPolish = clamp(input.stage === "live" ? 12 : input.stage === "MVP" ? 11 : 9, 0, 15);
  const communityShareability = clamp(input.pitchNotes && input.pitchNotes.length > 40 ? 8 : 6, 0, 10);
  const total = ogNativeDepth + aiNativeUsefulness + demoClarity + productPolish + communityShareability;
  return { ogNativeDepth, aiNativeUsefulness, demoClarity, productPolish, communityShareability, total };
}

function scoreWithFloor(raw: number | undefined, floor: number, max: number): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return floor;
  return clamp(Math.max(raw, floor), 0, max);
}

function scoreText(value: string | undefined, max: number): number {
  const textValue = value ?? "";
  const proofWords = ["0g", "storage", "compute", "chain", "mainnet", "agent", "ai", "proof", "hash", "verify"];
  const hits = proofWords.filter((word) => textValue.toLowerCase().includes(word)).length;
  return Math.min(max, Math.round(max * 0.45 + hits * 2.5 + Math.min(textValue.length / 220, max * 0.25)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function list(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.length > 0 ? value.map(String).slice(0, 8) : fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function clampScore(value: unknown, max: number, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(max, Math.round(numeric)));
}

function normalizeRecommendation(value: unknown): PlatformVideoScoreResult["recommendation"] {
  return value === "approve" || value === "reject" || value === "review" ? value : "review";
}

function higher(a: number, b: number, nameA: string, nameB: string, tieLabel: string): string {
  if (a === b) return tieLabel;
  return a > b ? nameA : nameB;
}

function summaryForAi(capsule: ProjectCapsule) {
  return {
    id: capsule.id,
    projectName: capsule.projectName,
    teamName: capsule.teamName,
    round: capsule.round,
    campaignName: capsule.campaignName,
    campaignType: capsule.campaignType,
    checkpointLabel: capsule.checkpointLabel,
    stage: capsule.stage,
    tagline: capsule.tagline,
    scoutBrief: capsule.scoutBrief,
    proofAnalysis: capsule.proofAnalysis,
    scores: capsule.scores,
    risks: capsule.risks,
    nextRoundTasks: capsule.nextRoundTasks,
    storageRoot: capsule.storageRoot
  };
}
