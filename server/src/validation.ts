import { z } from "zod";
import { rounds, stages } from "../../shared/types.js";

export const capsuleInputSchema = z.object({
  projectName: z.string().min(2).max(90),
  teamName: z.string().min(2).max(90),
  tagline: z.string().min(4).max(140),
  repoUrl: z.string().url(),
  demoUrl: z.string().url(),
  creatorWallet: z.string().optional(),
  round: z.enum(rounds),
  description: z.string().min(20).max(4000),
  ogUsageClaims: z.string().min(20).max(3000),
  pitchNotes: z.string().max(3000).optional(),
  stage: z.enum(stages),
  previousCapsuleId: z.string().optional()
});

export const matchupInputSchema = z.object({
  capsuleAId: z.string().min(3),
  capsuleBId: z.string().min(3)
});
