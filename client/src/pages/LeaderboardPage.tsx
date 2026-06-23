import { useEffect, useMemo, useState } from "react";
import type { CapsuleIndexRecord } from "../../../shared/types";
import { campaignPresets } from "../../../shared/campaigns";
import { api } from "../api";
import { ProjectRow } from "../components";

export function LeaderboardPage() {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[] | null>(null);
  const [campaign, setCampaign] = useState<string | "All">("All");

  useEffect(() => {
    void api.capsules().then(setCapsules).catch(() => setCapsules([]));
  }, []);

  const filtered = useMemo(() => {
    if (!capsules) return [];
    return capsules
      .filter((item) => campaign === "All" || item.campaignId === campaign)
      .sort((a, b) => b.scores.total - a.scores.total);
  }, [capsules, campaign]);

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Projects</span>
        <h1>Project Passports</h1>
        <p>Browse individual builds from any campaign or solo path. Use this directory to inspect proof, track progress, or pick projects to compare with yours.</p>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Filter label="All" active={campaign === "All"} onClick={() => setCampaign("All")} />
        {campaignPresets.map((item) => (
          <Filter key={item.id} label={item.name} active={campaign === item.id} onClick={() => setCampaign(item.id)} />
        ))}
      </div>

      {capsules === null ? (
        <div className="empty">Loading profiles...</div>
      ) : filtered.length === 0 ? (
        <div className="surface empty">No profiles yet. Create the first one.</div>
      ) : (
        <div className="rows">
          <div className="rows-head">
            <div>Project</div>
            <div className="col-builder">Builder</div>
            <div className="col-round">Checkpoint</div>
            <div>Signal</div>
            <div>Proof</div>
          </div>
          {filtered.map((capsule) => <ProjectRow capsule={capsule} key={capsule.id} />)}
        </div>
      )}
    </main>
  );
}

function Filter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-ghost btn-sm"
      style={active ? { borderColor: "var(--accent)", color: "var(--text)", background: "var(--accent-soft)" } : undefined}
    >
      {label}
    </button>
  );
}
