import type { CampaignPreset, CapsuleIndexRecord, MatchupReport, ProjectCapsule, ProjectCapsuleInput, PublicConfig } from "../../shared/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  config: () => request<PublicConfig>("/api/config/public"),
  campaigns: () => request<CampaignPreset[]>("/api/campaigns"),
  campaign: (id: string) => request<CampaignPreset & { profileCount: number; storedProofs: number; latestProfiles: CapsuleIndexRecord[] }>(`/api/campaigns/${id}`),
  campaignCapsules: (id: string) => request<CapsuleIndexRecord[]>(`/api/campaigns/${id}/capsules`),
  projects: () => request<CapsuleIndexRecord[]>("/api/projects"),
  capsules: () => request<CapsuleIndexRecord[]>("/api/capsules"),
  capsule: (id: string) => request<ProjectCapsule>(`/api/capsules/${id}`),
  createCapsule: (input: ProjectCapsuleInput) =>
    request<ProjectCapsule>("/api/capsules", { method: "POST", body: JSON.stringify(input) }),
  matchups: () => request<MatchupReport[]>("/api/matchups"),
  createMatchup: (capsuleAId: string, capsuleBId: string) =>
    request<MatchupReport>("/api/matchups", { method: "POST", body: JSON.stringify({ capsuleAId, capsuleBId }) })
};
