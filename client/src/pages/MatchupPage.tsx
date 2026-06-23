import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { CapsuleIndexRecord, MatchupReport } from "../../../shared/types";
import { api } from "../api";
import { ProofLogo, TaskList, type ProofState } from "../components";
import { isRealProof, shortHash } from "../utils";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; report: MatchupReport }
  | { kind: "error"; message: string };

export function MatchupPage() {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    void api.projects().then((items) => {
      setCapsules(items);
      setA(items[0]?.id ?? "");
      setB(items[1]?.id ?? "");
    }).catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!a || !b || a === b) return;
    setState({ kind: "loading" });
    try {
      const report = await api.createMatchup(a, b);
      setState({ kind: "ready", report });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Comparison failed" });
    }
  }

  const report = state.kind === "ready" ? state.report : null;
  const proofState: ProofState = report
    ? isRealProof(report.storageMode) ? "complete" : "error"
    : state.kind === "loading" ? "active" : "pending";

  return (
    <main className="page-narrow section-stack">
      <header className="page-heading">
        <span className="eyebrow">Compare</span>
        <h1>Compare two Project Passports</h1>
        <p>Pick live projects already on ZeroScout. If a project is missing, create a quick Project Passport first, then compare proof clarity, demo strength, public story, and next move.</p>
      </header>

      <section className="surface surface-pad">
        <form className="compare-form" onSubmit={submit}>
          <div className="field">
            <label>Project A</label>
            <select value={a} onChange={(e) => setA(e.target.value)}>
              {capsules.map((item) => <option value={item.id} key={item.id}>{item.projectName}</option>)}
            </select>
          </div>
          <div className="compare-vs">vs</div>
          <div className="field">
            <label>Project B</label>
            <select value={b} onChange={(e) => setB(e.target.value)}>
              {capsules.map((item) => <option value={item.id} key={item.id}>{item.projectName}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={state.kind === "loading" || !a || !b || a === b} style={{ width: "auto", minWidth: 160 }}>
            {state.kind === "loading" ? <Loader2 className="spin" size={14} /> : <ArrowRight size={14} />}
            {state.kind === "loading" ? "Comparing..." : "Compare"}
          </button>
        </form>
        {state.kind === "error" && <div className="error-banner" style={{ marginTop: 14 }}>{state.message}</div>}
      </section>

      {report && (
        <section className="surface surface-pad section-stack">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Comparison</div>
              <h2 style={{ margin: 0, fontSize: 22 }}>{report.capsuleAName} <span style={{ color: "var(--muted)", fontWeight: 400 }}>vs</span> {report.capsuleBName}</h2>
            </div>
            <ProofLogo state={proofState} size="xs" caption={{ title: isRealProof(report.storageMode) ? "Stored" : "Local", sub: shortHash(report.storageRoot) }} />
          </div>

          <div className="section">
            <h2>Summary</h2>
            <p>{report.summary}</p>
          </div>

          <div className="compare-grid">
            <div className="compare-col">
              <h3>Clearer record</h3>
              <p>{report.strongerProof}</p>
            </div>
            <div className="compare-col">
              <h3>Clearer demo</h3>
              <p>{report.clearerDemo}</p>
            </div>
          </div>

          <div className="section">
            <h2>Public story</h2>
            <p>{report.strongerPublicVoteCase}</p>
          </div>

          <div className="compare-grid">
            <div className="compare-col">
              <h3>Fix for {report.capsuleAName}</h3>
              <TaskList items={report.risksForA} />
              <p style={{ marginTop: 10 }}><b style={{ color: "var(--text)" }}>Next move:</b> {report.nextMoveForA}</p>
            </div>
            <div className="compare-col">
              <h3>Fix for {report.capsuleBName}</h3>
              <TaskList items={report.risksForB} />
              <p style={{ marginTop: 10 }}><b style={{ color: "var(--text)" }}>Next move:</b> {report.nextMoveForB}</p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
