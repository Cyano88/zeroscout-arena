import { z } from "zod";
import { campaignTypes, rounds, stages } from "../../shared/types.js";

export const capsuleInputSchema = z.object({
  projectName: z.string().min(2).max(90),
  teamName: z.string().min(2).max(90),
  tagline: z.string().min(4).max(140),
  repoUrl: z.string().url(),
  demoUrl: z.string().url(),
  videoDemoUrl: z.string().url().refine(isSupportedVideoUrl, "Video walkthrough URL must be a YouTube or Loom link.").optional(),
  creatorWallet: z.string().optional(),
  round: z.enum(rounds),
  description: z.string().min(20).max(4000),
  ogUsageClaims: z.string().min(20).max(3000),
  pitchNotes: z.string().max(3000).optional(),
  stage: z.enum(stages),
  previousCapsuleId: z.string().optional(),
  campaignId: z.string().min(2).max(100).optional(),
  campaignName: z.string().min(2).max(120).optional(),
  campaignType: z.enum(campaignTypes).optional(),
  checkpointLabel: z.string().min(2).max(120).optional(),
  checkpointNumber: z.number().int().min(0).max(1000).optional(),
  builderWallet: z.string().max(120).optional(),
  builderEmail: z.string().email().optional(),
  mentorFocus: z.string().max(2000).optional(),
  helpNeeded: z.string().max(240).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  source: z.enum(["hosted", "deeplink", "embed", "api"]).optional(),
  externalUserId: z.string().max(160).optional(),
  externalOrgId: z.string().max(160).optional()
});

export const matchupInputSchema = z.object({
  capsuleAId: z.string().min(3),
  capsuleBId: z.string().min(3)
});

function isSupportedVideoUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtube.com" || host === "youtu.be" || host === "loom.com";
  } catch {
    return false;
  }
}
