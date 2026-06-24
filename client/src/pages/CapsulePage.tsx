import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, GitBranch, Loader2, PlayCircle, Share2 } from "lucide-react";
import type { CapsuleIndexRecord, ClaimStartResponse, ProjectCapsule } from "../../../shared/types";
import { api } from "../api";
import { CopyButton, ProofLogo, ScoreStrip, TaskList, type ProofState } from "../components";
import { explorerTxUrl, isRealProof, shortHash } from "../utils";

export function CapsulePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [capsule, setCapsule] = useState<ProjectCapsule | null>(null);
  const [versions, setVersions] = useState<CapsuleIndexRecord[]>([]);
  const [error, setError] = useState("");
  const root = searchParams.get("root");
  const tx = searchParams.get("tx");

  useEffect(() => {
    if (!id) return;
    void api.capsule(id, root, tx).then(setCapsule).catch((err) => setError(err instanceof Error ? err.message : "Project not found"));
    void api.capsuleVersions(id, root, tx).then(setVersions).catch(() => setVersions([]));
  }, [id, root, tx]);

  if (error) return <main className="page-narrow"><div className="error-banner">{error}</div></main>;
  if (!capsule) return <main className="page-narrow"><div className="empty">Loading project profile...</div></main>;

  const real = isRealProof(capsule.storageMode);
  const proofState: ProofState = real ? "complete" : "error";
  const shareUrl = proofUrl(capsule);
  const txUrl = explorerTxUrl(capsule.network, capsule.storageTxHash);
  const registryTxUrl = explorerTxUrl(capsule.network, capsule.registryTxHash);

  return (
    <main className="page-narrow section-stack">
      <div>
        <Link to="/projects" className="btn btn-ghost btn-sm" style={{ display: "inline-flex" }}>
          <ArrowLeft size={12} /> All projects
        </Link>
      </div>

      <section className="surface profile-header">
        <div>
          <div className="profile-meta">
            <span>{capsule.campaignName ?? "ZeroScout"}</span>
            <span className="dot" />
            <span>{capsule.checkpointLabel ?? capsule.round}</span>
            <span className="dot" />
            <span>v{capsule.versionNumber ?? 1}</span>
            <span className="dot" />
            <span>{capsule.stage}</span>
            <span className="dot" />
            <span className={`status-tag ${real ? "ok" : "warn"}`} style={{ borderRadius: 999 }}>
              <span className="dot" />{real ? "Verified" : "Draft"}
            </span>
          </div>
          <h1>{capsule.projectName}</h1>
          <p className="profile-promise">{capsule.tagline}</p>
          <div className="profile-byline">
            <span><strong>{capsule.teamName}</strong> - builder</span>
            <span><strong>{shortHash(capsule.storageRoot)}</strong> - root</span>
            {capsule.storageTxHash && <span><strong>{shortHash(capsule.storageTxHash)}</strong> - tx</span>}
          </div>
        </div>
        <div className="profile-proof">
          <ProofLogo state={proofState} size="sm" caption={{ title: real ? "Proof stored" : "Local fallback", sub: shortHash(capsule.storageRoot) }} />
        </div>
      </section>

      <section className="surface score-block">
        <div className="score-top">
          <div className="score-total"><b>{capsule.scores.total}</b><small>/ 100 readiness signal</small></div>
          <span className="label">Signal</span>
        </div>
        <ScoreStrip scores={capsule.scores} />
      </section>

      <ProofActions capsule={capsule} shareUrl={shareUrl} txUrl={txUrl} registryTxUrl={registryTxUrl} />

      <UpdateProjectSection capsule={capsule} />

      <ClaimSection capsule={capsule} onClaimed={setCapsule} />

      <VideoReviewSection capsule={capsule} root={root} tx={tx} onReviewed={(videoReview) => setCapsule({ ...capsule, videoReview })} />

      {versions.length > 1 && (
        <section className="surface section">
          <h2>Version history</h2>
          <p>Each update is a new stored checkpoint for the same repo and program.</p>
          <div className="record-rows" style={{ marginTop: 14 }}>
            {versions.map((item) => (
              <Link className="record-row version-row" to={`/projects/${item.id}?root=${encodeURIComponent(item.storageRoot)}${item.storageTxHash ? `&tx=${encodeURIComponent(item.storageTxHash)}` : ""}`} key={item.id}>
                <span className="k">v{item.versionNumber ?? 1} - {item.checkpointLabel ?? item.round}</span>
                <span className="v">{item.scores.total}/100 - {shortHash(item.storageRoot)}</span>
                <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="surface section">
        <h2>What it does</h2>
        <p>{capsule.technicalSummary}</p>
      </section>

      <section className="surface section">
        <h2>What 0G powers</h2>
        <p>{capsule.proofAnalysis}</p>
      </section>

      <section className="surface section">
        <h2>AI Scout Signal</h2>
        <p>{capsule.scoutBrief}</p>
      </section>

      <section className="surface section">
        <h2>Next steps</h2>
        <TaskList items={capsule.nextRoundTasks} />
        {capsule.risks.length > 0 && (
          <>
            <h2 style={{ marginTop: 22 }}>What to fix</h2>
            <TaskList items={capsule.risks} />
          </>
        )}
        {capsule.survivalDelta && (
          <div style={{ marginTop: 22, padding: 18, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-2)" }}>
            <h2 style={{ fontSize: 14, marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <GitBranch size={14} /> Progress since previous version
            </h2>
            <p style={{ marginBottom: 10 }}>{capsule.survivalDelta.ogUsageDelta}</p>
            <TaskList items={capsule.survivalDelta.topPriorities} />
          </div>
        )}
      </section>

      <section className="surface section">
        <h2>Share kit</h2>
        <Campaign label="Short pitch" value={capsule.campaignPack.voterPitch} />
        <Campaign label="X post" value={capsule.campaignPack.xPost} />
        <Campaign label="Telegram / Discord" value={capsule.campaignPack.telegramPost} />
        <Campaign label="Sponsor summary" value={capsule.campaignPack.sponsorSummary} />
      </section>

      <section className="surface section">
        <h2>Full record</h2>
        <div className="record-rows">
          <Row k="Campaign" value={capsule.campaignName ?? "ZeroScout"} disableCopy />
          <Row k="Checkpoint" value={capsule.checkpointLabel ?? capsule.round} disableCopy />
          <Row k="Version" value={`v${capsule.versionNumber ?? 1}`} disableCopy />
          <Row k="Root" value={capsule.storageRoot} />
          <Row k="Content hash" value={capsule.capsuleHash} />
          <Row k="Transaction" value={capsule.storageTxHash ?? "-"} disabled={!capsule.storageTxHash} />
          <Row k="Registry tx" value={capsule.registryTxHash ?? "-"} disabled={!capsule.registryTxHash} />
          <Row k="Ownership" value={capsule.ownership ? "Claimed by repo proof" : "Unclaimed"} disableCopy />
          <Row k="AI provider" value={capsule.aiProvider} disableCopy />
          <Row k="Video demo" value={capsule.videoDemoUrl ?? "-"} disabled={!capsule.videoDemoUrl} disableCopy />
        </div>
      </section>
    </main>
  );
}

function ProofActions({ capsule, shareUrl, txUrl, registryTxUrl }: { capsule: ProjectCapsule; shareUrl: string; txUrl?: string | null; registryTxUrl?: string | null }) {
  return (
    <section className="surface section proof-summary">
      <div>
        <h2>Verify</h2>
        <p>This passport is the project snapshot. Updates create a new version; old 0G roots stay immutable.</p>
      </div>
      <div className="proof-facts">
        <span><b>{shortHash(capsule.storageRoot)}</b> storage root</span>
        {capsule.registryTxHash && <span><b>{shortHash(capsule.registryTxHash)}</b> registry tx</span>}
        <span><b>{capsule.ownership ? "Claimed" : "Unclaimed"}</b> ownership</span>
      </div>
      <div className="action-row">
        <a className="btn btn-ghost btn-sm" href={`/api/capsules/${capsule.id}.json?root=${encodeURIComponent(capsule.storageRoot)}${capsule.storageTxHash ? `&tx=${encodeURIComponent(capsule.storageTxHash)}` : ""}`} target="_blank" rel="noreferrer">
          <Download size={13} /> JSON
        </a>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>
          <Share2 size={13} /> Share
        </button>
        {txUrl && <a className="btn btn-ghost btn-sm" href={txUrl} target="_blank" rel="noreferrer">Storage tx <ExternalLink size={13} /></a>}
        {registryTxUrl && <a className="btn btn-ghost btn-sm" href={registryTxUrl} target="_blank" rel="noreferrer">Registry tx <ExternalLink size={13} /></a>}
        <a className="btn btn-ghost btn-sm" href={capsule.repoUrl} target="_blank" rel="noreferrer">Repo <ExternalLink size={13} /></a>
        <a className="btn btn-ghost btn-sm" href={capsule.demoUrl} target="_blank" rel="noreferrer">Live demo <ExternalLink size={13} /></a>
        {capsule.videoDemoUrl && <a className="btn btn-ghost btn-sm" href={capsule.videoDemoUrl} target="_blank" rel="noreferrer">Video <ExternalLink size={13} /></a>}
      </div>
    </section>
  );
}

function UpdateProjectSection({ capsule }: { capsule: ProjectCapsule }) {
  const updateUrl = updateProjectUrl(capsule);
  return (
    <section className="surface section update-panel">
      <div>
        <h2>Update project</h2>
        <p>Shipped something new? Publish an updated passport for the same repo. ZeroScout links it as version history instead of listing a duplicate project.</p>
      </div>
      <Link className="btn btn-primary btn-sm" to={updateUrl}>
        Modify passport <ArrowRight size={13} />
      </Link>
    </section>
  );
}

function VideoReviewSection({ capsule, root, tx, onReviewed }: { capsule: ProjectCapsule; root: string | null; tx: string | null; onReviewed: (review: NonNullable<ProjectCapsule["videoReview"]>) => void }) {
  const [state, setState] = useState<"idle" | "reviewing">("idle");
  const [error, setError] = useState("");
  const review = capsule.videoReview;

  async function runReview() {
    setError("");
    setState("reviewing");
    try {
      onReviewed(await api.createVideoReview(capsule.id, root, tx));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video review failed");
    } finally {
      setState("idle");
    }
  }

  if (!capsule.videoDemoUrl && !review) return null;

  return (
    <section className="surface section">
      <h2>Video review</h2>
      {capsule.videoDemoUrl && <p>ZeroScout can review the walkthrough with a video-capable 0G Compute model and store the review as a separate 0G artifact.</p>}
      {review ? (
        <>
          <p>{review.summary}</p>
          <div className="record-rows" style={{ marginTop: 14 }}>
            <Row k="AI provider" value={review.aiProvider} disableCopy />
            <Row k="Review root" value={review.storageRoot} />
            <Row k="Review tx" value={review.storageTxHash ?? "-"} disabled={!review.storageTxHash} />
          </div>
          <h2 style={{ marginTop: 22 }}>Observed proof flow</h2>
          <p>{review.proofFlowObserved}</p>
          <h2 style={{ marginTop: 22 }}>Demo notes</h2>
          <TaskList items={review.demoClarityNotes} />
          <h2 style={{ marginTop: 22 }}>Recommended cuts</h2>
          <TaskList items={review.recommendedCuts} />
        </>
      ) : (
        <button className="btn btn-primary btn-sm" type="button" onClick={runReview} disabled={state === "reviewing"} style={{ width: "auto", marginTop: 14 }}>
          {state === "reviewing" ? <Loader2 className="spin" size={13} /> : <PlayCircle size={13} />}
          Review video with 0G
        </button>
      )}
      {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}
    </section>
  );
}

function ClaimSection({ capsule, onClaimed }: { capsule: ProjectCapsule; onClaimed: (capsule: ProjectCapsule) => void }) {
  const [claim, setClaim] = useState<ClaimStartResponse | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "verifying">("idle");
  const [error, setError] = useState("");

  async function startClaim() {
    setError("");
    setState("starting");
    try {
      setClaim(await api.startClaim(capsule.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim setup failed");
    } finally {
      setState("idle");
    }
  }

  async function verifyClaim() {
    setError("");
    setState("verifying");
    try {
      onClaimed(await api.verifyClaim(capsule.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim verification failed");
    } finally {
      setState("idle");
    }
  }

  if (capsule.ownership) {
    const claimRegistryTxUrl = explorerTxUrl(capsule.network, capsule.ownership.claimRegistryTxHash);
    return (
      <section className="surface section">
        <h2>Ownership</h2>
        <p>This project is claimed by repo proof. The claim proof is stored on 0G.</p>
        <div className="record-rows" style={{ marginTop: 14 }}>
          <Row k="Method" value="Repo file proof" disableCopy />
          <Row k="Claim root" value={capsule.ownership.claimRoot} />
          <Row k="Claim registry tx" value={capsule.ownership.claimRegistryTxHash ?? "-"} disabled={!capsule.ownership.claimRegistryTxHash} />
          <Row k="Verified" value={new Date(capsule.ownership.verifiedAt).toLocaleString()} disableCopy />
        </div>
        {claimRegistryTxUrl && (
          <a className="btn btn-ghost btn-sm" href={claimRegistryTxUrl} target="_blank" rel="noreferrer" style={{ width: "auto", marginTop: 14 }}>
            Claim registry tx <ExternalLink size={13} />
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="surface section">
      <h2>Claim project</h2>
      <p>Prove this repo is yours to publish official updates. Add one verification file to the repo. No script. No install.</p>
      {!claim ? (
        <button className="btn btn-primary btn-sm" type="button" onClick={startClaim} disabled={state === "starting"} style={{ width: "auto", marginTop: 14 }}>
          {state === "starting" ? <Loader2 className="spin" size={13} /> : <Check size={13} />}
          Claim project
        </button>
      ) : (
        <div className="record-rows" style={{ marginTop: 14 }}>
          <Row k="File path" value={claim.expectedPath} disableCopy />
          <div className="record-row">
            <span className="k">File content</span>
            <span className="v" title={claim.expectedContent}>{claim.expectedContent.replace(/\n/g, " / ")}</span>
            <CopyButton value={claim.expectedContent} />
          </div>
          <Row k="Checks" value={claim.rawUrls.join(" | ")} disableCopy />
        </div>
      )}
      {claim && (
        <button className="btn btn-primary btn-sm" type="button" onClick={verifyClaim} disabled={state === "verifying"} style={{ width: "auto", marginTop: 14 }}>
          {state === "verifying" ? <Loader2 className="spin" size={13} /> : <Check size={13} />}
          Verify repo file
        </button>
      )}
      {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}
    </section>
  );
}

function proofUrl(capsule: ProjectCapsule): string {
  const url = new URL(`/projects/${capsule.id}`, window.location.origin);
  url.searchParams.set("root", capsule.storageRoot);
  if (capsule.storageTxHash) url.searchParams.set("tx", capsule.storageTxHash);
  return url.toString();
}

function updateProjectUrl(capsule: ProjectCapsule): string {
  const params = new URLSearchParams({
    campaign: capsule.campaignId ?? "zero-cup",
    previous: capsule.id,
    project: capsule.projectName,
    builder: capsule.teamName,
    repo: capsule.repoUrl,
    demo: capsule.demoUrl,
    tagline: capsule.tagline,
    checkpoint: capsule.checkpointLabel ?? capsule.round,
    visibility: capsule.visibility ?? "public"
  });
  if (capsule.videoDemoUrl) params.set("video", capsule.videoDemoUrl);
  if (capsule.helpNeeded) params.set("help", capsule.helpNeeded);
  return `/?${params.toString()}`;
}

function Row({ k, value, disabled, disableCopy }: { k: string; value: string; disabled?: boolean; disableCopy?: boolean }) {
  return (
    <div className="record-row" style={disabled ? { opacity: 0.55 } : undefined}>
      <span className="k">{k}</span>
      <span className="v" title={value}>{disableCopy ? value : shortHash(value)}</span>
      {disableCopy ? <span /> : <CopyButton value={value} />}
    </div>
  );
}

function Campaign({ label, value }: { label: string; value: string }) {
  return (
    <div className="campaign-row">
      <span className="k">{label}</span>
      <p>{value}</p>
      <button className="icon-btn" type="button" title="Copy" onClick={() => navigator.clipboard.writeText(value)}>
        <Copy size={13} />
      </button>
    </div>
  );
}
