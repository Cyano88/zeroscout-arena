import { useEffect, useMemo, useState } from "react";
import { rounds, type CapsuleIndexRecord, type Round } from "../../../shared/types";
import { api } from "../api";
import { ProjectRow } from "../components";

export function LeaderboardPage() {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[] | null>(null);
  const [round, setRound] = useState<Round | "All">("All");

  useEffect(() => {
    void api.capsules().then(setCapsules).catch(() => setCapsules([]));
  }, []);

  const filtered = useMemo(() => {
    if (!capsules) return [];
    return capsules
      .filter((item) => round === "All" || item.round === round)
      .sort((a, b) => b.scores.total - a.scores.total);
  }, [capsules, round]);

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Projects</span>
        <h1>Project profiles</h1>
        <p>Browse the readiness signal across teams. The list reflects current proof status, not an official ranking.</p>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Filter label="All" active={round === "All"} onClick={() => setRound("All")} />
        {rounds.map((r) => (
          <Filter key={r} label={r} active={round === r} onClick={() => setRound(r)} />
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
            <div className="col-round">Round</div>
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
