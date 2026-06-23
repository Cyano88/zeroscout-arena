import type { CampaignPreset, CampaignType } from "./types.js";

export const defaultCampaignId = "zero-cup";

export const campaignPresets: CampaignPreset[] = [
  {
    id: "zero-cup",
    name: "Zero Cup",
    type: "hackathon",
    description: "Hackathon and ecosystem campaign for AI-native apps, agents, companions, and games.",
    checkpointLabel: "Group Stage",
    checkpoints: ["Group Stage", "Round of 32", "Round of 16", "Quarter Finals", "Semi Finals", "Final"],
    helpOptions: ["0G proof", "AI usefulness", "demo clarity", "product polish", "community campaign"]
  },
  {
    id: "grail-builders-university",
    name: "Grail Builders University",
    type: "cohort",
    description: "University and tutor-program checkpoint system for students shipping agent-powered products.",
    checkpointLabel: "Application",
    checkpoints: ["Application", "Week 1", "Week 2", "Week 3", "Demo Day"],
    helpOptions: ["product", "agents", "BD", "funding", "distribution", "ecosystem intros"]
  },
  {
    id: "custom",
    name: "Solo Builder Program",
    type: "custom",
    description: "Independent Project Passports for builders growing traction without an affiliated campaign.",
    checkpointLabel: "Checkpoint 1",
    checkpoints: ["Checkpoint 1", "Checkpoint 2", "Milestone", "Demo Day"],
    helpOptions: ["product", "technical review", "funding", "distribution", "mentor review"]
  }
];

export function normalizeCampaignId(value?: string): string {
  const slug = String(value ?? defaultCampaignId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || defaultCampaignId;
}

export function findCampaignPreset(id?: string): CampaignPreset {
  const normalized = normalizeCampaignId(id);
  return campaignPresets.find((campaign) => campaign.id === normalized) ?? {
    ...campaignPresets[campaignPresets.length - 1],
    id: normalized,
    name: titleFromSlug(normalized),
    type: "custom" satisfies CampaignType
  };
}

function titleFromSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
