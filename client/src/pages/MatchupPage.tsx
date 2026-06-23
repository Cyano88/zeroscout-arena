import { FormEvent, useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import type { CapsuleIndexRecord, MatchupReport } from "../../../shared/types";
import { api } from "../api";
import { ProofBadge, TaskList } from "../components";

export function MatchupPage() {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [report, setReport] = useState<MatchupReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.capsules().then((items) => {
      setCapsules(items);
      setA(items[0]?.id ?? "");
      setB(items[1]?.id ?? "");
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setReport(await api.createMatchup(a, b));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="single-page">
      <section className="panel">
        <span className="eyebrow">Project comparison</span>
        <h1>Compare two projects</h1>
        <p className="large-copy">Pick two projects and get a plain-English comparison: clearer record, stronger demo, better public story, and the next move for each team.</p>
        <form className="matchup-form" onSubmit={submit}>
          <select value={a} onChange={(e) => setA(e.target.value)}>{capsules.map((item) => <option value={item.id} key={item.id}>{item.projectName}</option>)}</select>
          <select value={b} onChange={(e) => setB(e.target.value)}>{capsules.map((item) => <option value={item.id} key={item.id}>{item.projectName}</option>)}</select>
          <button className="primary-button" disabled={loading || !a || !b}>{loading ? <Loader2 className="spin" size={18} /> : <Scale size={18} />} Compare projects</button>
        </form>
        {error && <div className="error-box">{error}</div>}
      </section>
      {report && (
        <section className="panel matchup-report">
          <div className="section-head compact"><h2>{report.capsuleAName} vs {report.capsuleBName}</h2><ProofBadge capsule={report} /></div>
          <p className="large-copy">{report.summary}</p>
          <div className="two-col">
            <div><h3>Clearer record</h3><p>{report.strongerProof}</p></div>
            <div><h3>Clearer demo</h3><p>{report.clearerDemo}</p></div>
          </div>
          <h3>Public story</h3>
          <p>{report.strongerPublicVoteCase}</p>
          <div className="two-col">
            <div><h3>Fix for {report.capsuleAName}</h3><TaskList items={report.risksForA} /><p><b>Next move:</b> {report.nextMoveForA}</p></div>
            <div><h3>Fix for {report.capsuleBName}</h3><TaskList items={report.risksForB} /><p><b>Next move:</b> {report.nextMoveForB}</p></div>
          </div>
        </section>
      )}
    </main>
  );
}
