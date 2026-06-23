import OpenAI from "openai";
import { config } from "../config.js";
import type { CampaignPack, ProjectCapsule, ProjectCapsuleInput, SurvivalDelta } from "../../../shared/types.js";

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

export async function generateScout(input: ProjectCapsuleInput, previous?: ProjectCapsule): Promise<ScoutResult> {
  const prompt = scoutPrompt(input, previous);
  const ai = getAiClient();

  if (ai) {
    try {
      const response = await ai.client.chat.completions.create({
        model: ai.model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are ZeroScout, a neutral AI scouting agent for the 0G Zero Cup. Return strict JSON only. Use 'AI Scout Signal' language, never official judging language."
          },
          { role: "user", content: prompt }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return normalizeScout(JSON.parse(content), ai.label, input, previous);
      }
    } catch (error) {
      console.warn("AI provider failed, using deterministic scout fallback:", error);
    }
  }

  return deterministicScout(input, previous);
}

export async function generateMatchup(a: ProjectCapsule, b: ProjectCapsule): Promise<MatchupResult> {
  const ai = getAiClient();
  const prompt = `Compare these two Zero Cup proof capsules for a neutral tournament scouting brief.

Project A: ${JSON.stringify(summaryForAi(a))}
Project B: ${JSON.stringify(summaryForAi(b))}

Return JSON with keys summary, strongerProof, clearerDemo, strongerPublicVoteCase, risksForA, risksForB, nextMoveForA, nextMoveForB. Do not declare an official winner.`;

  if (ai) {
    try {
      const response = await ai.client.chat.completions.create({
        model: ai.model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return strict JSON only. This is an AI scouting signal, not official judging." },
          { role: "user", content: prompt }
        ]
      });
      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as Partial<MatchupResult>;
        return {
          aiProvider: ai.label,
          summary: text(parsed.summary, `${a.projectName} and ${b.projectName} show different strengths for the next Zero Cup cut.`),
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

function getAiClient(): { client: OpenAI; model: string; label: string } | undefined {
  if (config.computeApiKey) {
    return {
      client: new OpenAI({ apiKey: config.computeApiKey, baseURL: config.computeBaseUrl }),
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

function scoutPrompt(input: ProjectCapsuleInput, previous?: ProjectCapsule): string {
  return `Create a real-world Zero Cup scouting capsule for this team.

Zero Cup context: 0G Global Vibe Coding Tournament, six-round knockout. Teams must build AI-native apps, agents, companions, or games using 0G. 0G must do real work. Teams improve and resubmit between cuts. Early rounds are judged; quarter finals onward use community voting.

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

Make it specific, practical, and useful to a team trying to survive the next cut.`;
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

  return {
    aiProvider: provider,
    scoutBrief: text(raw.scoutBrief, `${input.projectName} is positioned as a ${input.stage} Zero Cup contender with a clear need to prove 0G-native work.`),
    technicalSummary: text(raw.technicalSummary, `${input.projectName} connects ${input.repoUrl} and ${input.demoUrl} into a public build snapshot for ${input.round}.`),
    proofAnalysis: text(raw.proofAnalysis, `The submitted 0G claims must be visible in the demo and backed by storage, compute, or chain proof.`),
    scores,
    risks: list(raw.risks, ["0G integration may read as a bolt-on unless proof is shown directly in the user flow."]),
    nextRoundTasks: list(raw.nextRoundTasks, ["Add a public proof walkthrough", "Tighten the demo path", "Prepare community voting copy"]),
    campaignPack: {
      voterPitch: text(raw.campaignPack?.voterPitch, `${input.projectName} gives Zero Cup voters a clear build to inspect, verify, and share.`),
      xPost: text(raw.campaignPack?.xPost, `We just published our ${input.round} proof capsule for ${input.projectName} on ZeroScout Arena.`),
      telegramPost: text(raw.campaignPack?.telegramPost, `${input.projectName} is live in the Zero Cup arena. Review the proof capsule, demo, and next-round roadmap.`),
      sponsorSummary: text(raw.campaignPack?.sponsorSummary, `${input.projectName} is a ${input.stage} project with a public repo, demo, and 0G usage claims ready for inspection.`)
    },
    survivalDelta: delta
  };
}

function deterministicScout(input: ProjectCapsuleInput, previous?: ProjectCapsule): ScoutResult {
  const scores = normalizeScores(undefined, input);
  return normalizeScout(
    {
      scoutBrief: `${input.projectName} is a ${input.round} Zero Cup contender from ${input.teamName}. The scout signal is strongest when the demo makes the 0G proof path visible in the first minute.`,
      technicalSummary: `${input.projectName} links a public repo and demo into a round snapshot. The product claim is: ${input.tagline}`,
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
        "Pin the next deadline and top three upgrade tasks on the capsule."
      ],
      campaignPack: {
        voterPitch: `${input.projectName} is building in public for the Zero Cup. Inspect the demo, verify the proof capsule, and track how the team improves before the next cut.`,
        xPost: `New Zero Cup proof capsule: ${input.projectName} by ${input.teamName}. Scout signal, 0G proof trail, and next-round plan are live. ${input.demoUrl}`,
        telegramPost: `${input.projectName} just entered the ZeroScout Arena for ${input.round}. The capsule shows what works, how 0G is used, and what ships before the next cut.`,
        sponsorSummary: `${input.teamName} is shipping ${input.projectName}, a ${input.stage} project with public repo, demo, and a 0G proof-focused improvement path.`
      }
    },
    "deterministic local scout fallback",
    input,
    previous
  );
}

function normalizeScores(raw: Partial<ProjectCapsule["scores"]> | undefined, input: ProjectCapsuleInput): ProjectCapsule["scores"] {
  const og = clamp(raw?.ogNativeDepth ?? scoreText(input.ogUsageClaims, 35), 0, 35);
  const ai = clamp(raw?.aiNativeUsefulness ?? Math.min(25, Math.round(scoreText(input.description + input.pitchNotes, 35) * 0.72)), 0, 25);
  const demo = clamp(raw?.demoClarity ?? (input.demoUrl ? 11 : 5), 0, 15);
  const polish = clamp(raw?.productPolish ?? (input.tagline.length > 12 ? 11 : 8), 0, 15);
  const community = clamp(raw?.communityShareability ?? (input.pitchNotes ? 8 : 6), 0, 10);
  return {
    ogNativeDepth: og,
    aiNativeUsefulness: ai,
    demoClarity: demo,
    productPolish: polish,
    communityShareability: community,
    total: clamp(raw?.total ?? og + ai + demo + polish + community, 0, 100)
  };
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
