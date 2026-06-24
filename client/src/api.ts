import type { AiHealthResponse, CampaignPreset, CapsuleIndexRecord, ClaimStartResponse, MatchupReport, ProjectCapsule, ProjectCapsuleInput, PublicConfig } from "../../shared/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(readableError(body.error, response.status));
  }
  return response.json() as Promise<T>;
}

function readableError(error: unknown, status: number): string {
  if (typeof error !== "string") return `Request failed: ${status}`;

  try {
    const parsed = JSON.parse(error) as unknown;
    if (Array.isArray(parsed)) {
      const first = parsed[0] as { path?: string[]; maximum?: number; minimum?: number; code?: string } | undefined;
      const field = first?.path?.[0] ? fieldLabel(first.path[0]) : "This field";
      if (first?.code === "too_big" && first.maximum) return `${field} is too long. Keep it under ${first.maximum} characters.`;
      if (first?.code === "too_small" && first.minimum) return `${field} needs a little more detail. Use at least ${first.minimum} characters.`;
    }
  } catch {
    // Keep the original server message when it is not a serialized validation payload.
  }

  return error;
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    projectName: "Project name",
    teamName: "Builder or team",
    tagline: "One-line outcome",
    description: "Product description",
    ogUsageClaims: "0G usage",
    pitchNotes: "Memory line",
    helpNeeded: "What you need next",
    repoUrl: "Repo URL",
    demoUrl: "Demo URL"
  };
  return labels[field] ?? "This field";
}

export const api = {
  config: () => request<PublicConfig>("/api/config/public"),
  aiHealth: () => request<AiHealthResponse>("/api/ai/health"),
  campaigns: () => request<CampaignPreset[]>("/api/campaigns"),
  campaign: (id: string) => request<CampaignPreset & { profileCount: number; storedProofs: number; latestProfiles: CapsuleIndexRecord[] }>(`/api/campaigns/${id}`),
  campaignCapsules: (id: string) => request<CapsuleIndexRecord[]>(`/api/campaigns/${id}/capsules`),
  projects: () => request<CapsuleIndexRecord[]>("/api/projects"),
  capsules: () => request<CapsuleIndexRecord[]>("/api/capsules"),
  capsule: (id: string, root?: string | null, tx?: string | null) =>
    request<ProjectCapsule>(`/api/capsules/${id}${proofQuery(root, tx)}`),
  capsuleVersions: (id: string, root?: string | null, tx?: string | null) =>
    request<CapsuleIndexRecord[]>(`/api/capsules/${id}/versions${proofQuery(root, tx)}`),
  createCapsule: (input: ProjectCapsuleInput) =>
    request<ProjectCapsule>("/api/capsules", { method: "POST", body: JSON.stringify(input) }),
  startClaim: (id: string) =>
    request<ClaimStartResponse>(`/api/capsules/${id}/claim/start`, { method: "POST" }),
  verifyClaim: (id: string) =>
    request<ProjectCapsule>(`/api/capsules/${id}/claim/verify`, { method: "POST" }),
  matchups: () => request<MatchupReport[]>("/api/matchups"),
  createMatchup: (capsuleAId: string, capsuleBId: string) =>
    request<MatchupReport>("/api/matchups", { method: "POST", body: JSON.stringify({ capsuleAId, capsuleBId }) })
};

function proofQuery(root?: string | null, tx?: string | null): string {
  const params = new URLSearchParams();
  if (root) params.set("root", root);
  if (tx) params.set("tx", tx);
  const query = params.toString();
  return query ? `?${query}` : "";
}
