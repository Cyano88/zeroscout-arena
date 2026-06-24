import type { AiHealthResponse, CampaignPreset, CapsuleIndexRecord, ClaimStartResponse, IntegrationKeyRecord, IntegrationTopUpRecord, MatchupReport, ProjectCapsule, ProjectCapsuleInput, PublicConfig, VideoReview } from "../../shared/types";

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
    demoUrl: "Live demo URL",
    videoDemoUrl: "Video walkthrough URL"
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
  createVideoReview: (id: string, root?: string | null, tx?: string | null) =>
    request<VideoReview>(`/api/capsules/${id}/video-review${proofQuery(root, tx)}`, { method: "POST" }),
  uploadVideoReview: async (id: string, file: File, root?: string | null, tx?: string | null, onProgress?: (progress: number) => void) => {
    const form = new FormData();
    form.append("video", file);
    return new Promise<VideoReview>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/capsules/${id}/video-upload-review${proofQuery(root, tx)}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          onProgress?.(8);
          return;
        }
        onProgress?.(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(JSON.parse(xhr.responseText) as VideoReview);
          return;
        }
        let body: { error?: unknown } = {};
        try {
          body = JSON.parse(xhr.responseText) as { error?: unknown };
        } catch {
          body = {};
        }
        reject(new Error(readableError(body.error, xhr.status)));
      };
      xhr.onerror = () => reject(new Error("Video upload failed. Check your connection and try again."));
      xhr.send(form);
    });
  },
  matchups: () => request<MatchupReport[]>("/api/matchups"),
  createMatchup: (capsuleAId: string, capsuleBId: string) =>
    request<MatchupReport>("/api/matchups", { method: "POST", body: JSON.stringify({ capsuleAId, capsuleBId }) }),
  integrationPricing: () =>
    request<{ costs: { capsule: number; videoScore: number }; creditsPerOg: number; treasuryAddress?: string; chainId: number; network: string }>("/api/integrations/pricing"),
  dashboardKeys: (wallet: string) =>
    request<{ keys: Omit<IntegrationKeyRecord, "keyHash">[]; balance: { creditedOg: string; creditsPurchased: number; topUpCount: number } }>(`/api/dashboard/keys?wallet=${encodeURIComponent(wallet)}`),
  createDashboardKey: (input: { wallet: string; name: string; partner: string }) =>
    request<Omit<IntegrationKeyRecord, "keyHash"> & { key: string }>("/api/dashboard/keys", { method: "POST", body: JSON.stringify(input) }),
  verifyTopUp: (input: { wallet: string; txHash: string }) =>
    request<IntegrationTopUpRecord & { keys: Omit<IntegrationKeyRecord, "keyHash">[] }>("/api/dashboard/topups/verify", { method: "POST", body: JSON.stringify(input) }),
  syncTopUps: (wallet: string) =>
    request<{ credited: IntegrationTopUpRecord[]; keys: Omit<IntegrationKeyRecord, "keyHash">[]; balance: { creditedOg: string; creditsPurchased: number; topUpCount: number }; scannedBlocks: number }>("/api/dashboard/topups/sync", { method: "POST", body: JSON.stringify({ wallet }) })
};

function proofQuery(root?: string | null, tx?: string | null): string {
  const params = new URLSearchParams();
  if (root) params.set("root", root);
  if (tx) params.set("tx", tx);
  const query = params.toString();
  return query ? `?${query}` : "";
}
