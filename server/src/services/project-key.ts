import crypto from "node:crypto";

export function projectKeyFor(campaignId: string | undefined, repoUrl: string): string {
  const normalized = normalizeRepoUrl(repoUrl);
  const source = `${campaignId ?? "custom"}:${normalized}`;
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 24);
}

export function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | undefined {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return undefined;
    const [owner, repoRaw] = url.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repoRaw) return undefined;
    const repo = repoRaw.replace(/\.git$/i, "");
    return { owner, repo };
  } catch {
    return undefined;
  }
}

function normalizeRepoUrl(repoUrl: string): string {
  const parsed = parseGitHubRepo(repoUrl);
  if (parsed) return `github.com/${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
  return repoUrl.trim().toLowerCase().replace(/\/+$/, "");
}
