import { useEffect, useMemo, useState } from "react";
import { rounds, type CapsuleIndexRecord, type Round } from "../../../shared/types";
import { api } from "../api";
import { CapsuleCard } from "../components";

export function LeaderboardPage() {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[]>([]);
  const [round, setRound] = useState<Round | "All">("All");

  useEffect(() => {
    void api.capsules().then(setCapsules);
  }, []);

  const rows = useMemo(() => capsules
    .filter((item) => round === "All" || item.round === round)
    .sort((a, b) => b.scores.total - a.scores.total), [capsules, round]);

  return (
    <main className="single-page">
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Projects</span>
            <h1>Current field</h1>
            <p className="large-copy">Browse project pages by round and strength.</p>
          </div>
          <select value={round} onChange={(e) => setRound(e.target.value as Round | "All")}>
            <option>All</option>
            {rounds.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="card-grid">
          {rows.map((capsule) => <CapsuleCard capsule={capsule} key={capsule.id} />)}
        </div>
      </section>
    </main>
  );
}
