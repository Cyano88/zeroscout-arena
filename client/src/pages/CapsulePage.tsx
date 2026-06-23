import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, ExternalLink, GitBranch, Share2 } from "lucide-react";
import type { ProjectCapsule } from "../../../shared/types";
import { api } from "../api";
import { CopyButton, ExternalProofLink, ProofBadge, ScoreBars, TaskList } from "../components";
import { shortHash } from "../utils";

export function CapsulePage() {
  const { id } = useParams();
  const [capsule, setCapsule] = useState<ProjectCapsule | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    void api.capsule(id).then(setCapsule).catch((err) => setError(err instanceof Error ? err.message : "Project not found"));
  }, [id]);

  if (error) return <main className="single-page"><div className="panel error-box">{error}</div></main>;
  if (!capsule) return <main className="single-page"><div className="panel">Loading project...</div></main>;

  const shareUrl = window.location.href;
  const explorerTx = capsule.storageTxHash ? `${capsule.network.includes("mainnet") ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai"}/tx/${capsule.storageTxHash}` : "";

  return (
    <main className="capsule-layout">
      <section className="panel capsule-hero">
        <div>
          <span className="eyebrow">{capsule.round} - {capsule.stage}</span>
          <h1>{capsule.projectName}</h1>
          <p>{capsule.tagline}</p>
        </div>
        <ProofBadge capsule={capsule} />
      </section>

      <section className="panel proof-panel">
        <h2>Record</h2>
        <div className="proof-grid">
          <ProofLine label="Root" value={capsule.storageRoot} />
          <ProofLine label="Content hash" value={capsule.capsuleHash} />
          <ProofLine label="Tx" value={capsule.storageTxHash ?? "pending / unavailable"} />
          <ProofLine label="AI" value={capsule.aiProvider} />
        </div>
        <div className="actions">
          <a className="secondary-button" href={`/api/capsules/${capsule.id}.json`} target="_blank" rel="noreferrer"><Download size={16} /> JSON</a>
          <button className="secondary-button" onClick={() => navigator.clipboard.writeText(shareUrl)}><Share2 size={16} /> Share</button>
          {explorerTx && <ExternalProofLink href={explorerTx} label="Open tx" />}
        </div>
      </section>

      <section className="panel">
        <h2>Project brief</h2>
        <p className="large-copy">{capsule.scoutBrief}</p>
        <h3>What it is</h3>
        <p>{capsule.technicalSummary}</p>
        <h3>0G record</h3>
        <p>{capsule.proofAnalysis}</p>
      </section>

      <section className="panel"><ScoreBars scores={capsule.scores} /></section>

      <section className="panel">
        <h2>Next steps</h2>
        <TaskList items={capsule.nextRoundTasks} />
        {capsule.survivalDelta && (
          <div className="delta-box">
            <h3><GitBranch size={16} /> Progress since last version</h3>
            <p>{capsule.survivalDelta.ogUsageDelta}</p>
            <TaskList items={capsule.survivalDelta.topPriorities} />
          </div>
        )}
      </section>

      <section className="panel">
        <h2>What to fix</h2>
        <TaskList items={capsule.risks} />
      </section>

      <section className="panel campaign-panel">
        <h2>Share kit</h2>
        <Campaign label="Short pitch" value={capsule.campaignPack.voterPitch} />
        <Campaign label="X post" value={capsule.campaignPack.xPost} />
        <Campaign label="Telegram / Discord" value={capsule.campaignPack.telegramPost} />
        <Campaign label="Sponsor summary" value={capsule.campaignPack.sponsorSummary} />
      </section>

      <section className="panel link-panel">
        <a href={capsule.repoUrl} target="_blank" rel="noreferrer">Repo <ExternalLink size={14} /></a>
        <a href={capsule.demoUrl} target="_blank" rel="noreferrer">Demo <ExternalLink size={14} /></a>
        <Link to="/matchup">Compare projects <ExternalLink size={14} /></Link>
      </section>
    </main>
  );
}

function ProofLine({ label, value }: { label: string; value: string }) {
  return <div className="proof-line"><span>{label}</span><code>{shortHash(value)}</code><CopyButton value={value} /></div>;
}

function Campaign({ label, value }: { label: string; value: string }) {
  return <div className="campaign-copy"><span>{label}</span><p>{value}</p><CopyButton value={value} /></div>;
}
