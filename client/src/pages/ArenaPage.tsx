import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Copy, ExternalLink, Loader2 } from "lucide-react";
import { rounds, stages, type CapsuleIndexRecord, type ProjectCapsuleInput, type ProjectCapsule } from "../../../shared/types";
import { api } from "../api";
import { ProofLogo, ProofRail, type ProofState } from "../components";
import { isRealProof, shortHash } from "../utils";

const emptyForm: ProjectCapsuleInput = {
  projectName: "",
  teamName: "",
  tagline: "",
  repoUrl: "",
  demoUrl: "",
  round: "Group Stage",
  description: "",
  ogUsageClaims: "",
  pitchNotes: "",
  stage: "MVP"
};

type FlowState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "stored"; capsule: ProjectCapsule }
  | { kind: "fallback"; capsule: ProjectCapsule }
  | { kind: "error"; message: string };

function detailsReady(form: ProjectCapsuleInput): boolean {
  return Boolean(form.projectName && form.teamName && form.tagline && form.repoUrl && form.demoUrl && form.description && form.ogUsageClaims);
}

export function ArenaPage() {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[]>([]);
  const [form, setForm] = useState<ProjectCapsuleInput>(emptyForm);
  const [flow, setFlow] = useState<FlowState>({ kind: "idle" });
  const navigate = useNavigate();

  useEffect(() => {
    void api.capsules().then(setCapsules).catch(() => undefined);
  }, []);

  const previousOptions = useMemo(
    () => capsules.filter((item) => item.projectName.toLowerCase() === form.projectName.toLowerCase() || item.teamName.toLowerCase() === form.teamName.toLowerCase()),
    [capsules, form.projectName, form.teamName]
  );

  const ready = detailsReady(form);
  const submitting = flow.kind === "submitting";
  const stored = flow.kind === "stored";
  const fallback = flow.kind === "fallback";
  const errored = flow.kind === "error";

  const steps = railSteps({ ready, submitting, stored, fallback, errored });
  const logoState: ProofState = stored ? "complete" : submitting ? "active" : errored || fallback ? "error" : "pending";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFlow({ kind: "submitting" });
    try {
      const capsule = await api.createCapsule(form);
      if (isRealProof(capsule.storageMode)) {
        setFlow({ kind: "stored", capsule });
      } else {
        setFlow({ kind: "fallback", capsule });
      }
    } catch (err) {
      setFlow({ kind: "error", message: err instanceof Error ? err.message : "Project profile creation failed" });
    }
  }

  const buttonLabel = submitting
    ? "Storing proof on 0G..."
    : stored
      ? "Proof page ready"
      : "Create proof page";

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Create</span>
        <h1>Create a verified project profile</h1>
        <p>Paste your repo, demo, and 0G usage notes. ZeroScout drafts the intelligence, stores the canonical record on 0G, and gives you a public proof page you can share.</p>
      </header>

      <div className="checkout-grid">
        <section className="surface surface-pad">
          <form className="checkout-form" onSubmit={submit}>
            <div className="field-row two">
              <Field label="Project name" value={form.projectName} onChange={(v) => setForm({ ...form, projectName: v })} placeholder="ZeroScout Arena" required />
              <Field label="Builder or team" value={form.teamName} onChange={(v) => setForm({ ...form, teamName: v })} placeholder="Your team" required />
            </div>

            <Field label="One-line promise" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} placeholder="What should a judge understand in one sentence?" required />

            <div className="field-row two">
              <Field label="Repo URL" type="url" value={form.repoUrl} onChange={(v) => setForm({ ...form, repoUrl: v })} placeholder="https://github.com/..." required />
              <Field label="Demo URL" type="url" value={form.demoUrl} onChange={(v) => setForm({ ...form, demoUrl: v })} placeholder="https://..." required />
            </div>

            <div className="field">
              <label>Round</label>
              <Segmented value={form.round} options={[...rounds]} onChange={(v) => setForm({ ...form, round: v as ProjectCapsuleInput["round"] })} />
            </div>

            <div className="field">
              <label>Stage</label>
              <Segmented value={form.stage} options={[...stages]} onChange={(v) => setForm({ ...form, stage: v as ProjectCapsuleInput["stage"] })} />
            </div>

            {previousOptions.length > 0 && (
              <div className="field">
                <label>Continue from a previous version</label>
                <select value={form.previousCapsuleId ?? ""} onChange={(e) => setForm({ ...form, previousCapsuleId: e.target.value || undefined })}>
                  <option value="">None</option>
                  {previousOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.projectName} - {item.round}</option>
                  ))}
                </select>
              </div>
            )}

            <Textarea label="What does the product do?" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Explain it plainly: who uses it and what they get." required />
            <Textarea label="What does 0G power?" value={form.ogUsageClaims} onChange={(v) => setForm({ ...form, ogUsageClaims: v })} placeholder="Storage, compute, chain, retrieval, agent memory..." required />
            <Textarea label="What should people remember?" value={form.pitchNotes ?? ""} onChange={(v) => setForm({ ...form, pitchNotes: v })} placeholder="The line you want voters, users, sponsors to repeat." />

            {errored && <div className="error-banner">{flow.message}</div>}
            {fallback && (
              <div className="error-banner" style={{ color: "var(--warn)", borderColor: "color-mix(in srgb, var(--warn) 50%, var(--line))", background: "color-mix(in srgb, var(--warn) 8%, transparent)" }}>
                Local fallback used - proof was not stored on 0G. Check your 0G keys before submitting to Zero Cup.
              </div>
            )}

            <button className="btn btn-primary" disabled={submitting || stored || !ready}>
              {submitting && <Loader2 className="spin" size={14} />}
              {!submitting && !stored && <ArrowRight size={14} />}
              {buttonLabel}
            </button>
          </form>
        </section>

        <aside>
          <ProofRail steps={steps} footer={<ProofLogo state={logoState} caption={proofCaption(flow)} />} />
          {stored && <Confirmation capsule={flow.capsule} onOpen={() => navigate(`/capsules/${flow.capsule.id}`)} />}
          {fallback && <FallbackNote capsule={flow.capsule} onOpen={() => navigate(`/capsules/${flow.capsule.id}`)} />}
        </aside>
      </div>

      {capsules.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <header className="page-heading" style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 20 }}>Recent profiles</h1>
            <p>The latest verified project profiles.</p>
          </header>
          <ul className="list" style={{ display: "grid", gap: 0 }}>
            {capsules.slice(0, 5).map((capsule) => (
              <li key={capsule.id} style={{ display: "block", padding: 0 }}>
                <Link to={`/capsules/${capsule.id}`} className="row" style={{ borderRadius: 10, marginTop: 8, border: "1px solid var(--line)", background: "var(--surface)" }}>
                  <div className="name">
                    <strong>{capsule.projectName}</strong>
                    <span>{capsule.tagline}</span>
                  </div>
                  <div className="builder">{capsule.teamName}</div>
                  <div className="round">{capsule.round}</div>
                  <div className="signal">
                    <div className="bar"><i style={{ width: `${capsule.scores.total}%` }} /></div>
                    <em style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", fontStyle: "normal" }}>{capsule.scores.total}</em>
                  </div>
                  <div>
                    <span className={`status-tag ${isRealProof(capsule.storageMode) ? "ok" : "warn"}`}><span className="dot" />{isRealProof(capsule.storageMode) ? "Stored" : "Local"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 16 }}>
            <Link to="/leaderboard" className="btn btn-ghost btn-sm" style={{ display: "inline-flex" }}>View all projects <ArrowRight size={13} /></Link>
          </div>
        </section>
      )}
    </main>
  );
}

function railSteps({ ready, submitting, stored, fallback, errored }: { ready: boolean; submitting: boolean; stored: boolean; fallback: boolean; errored: boolean }) {
  const detailsState: ProofState = ready ? "complete" : "active";
  const intelState: ProofState = stored || fallback ? "complete" : submitting ? "active" : "pending";
  const storedState: ProofState = stored ? "complete" : fallback || errored ? "error" : submitting ? "active" : "pending";
  const pageState: ProofState = stored ? "complete" : "pending";

  return [
    { label: "Project details", sub: ready ? "Ready" : "Fill in repo, demo, and 0G usage", state: detailsState },
    { label: "AI intelligence", sub: stored || fallback ? "Generated" : submitting ? "Drafting brief..." : "Waiting", state: intelState },
    { label: "Stored on 0G", sub: stored ? "Confirmed" : fallback ? "Local fallback only" : submitting ? "Submitting..." : "Waiting", state: storedState },
    { label: "Public page", sub: stored ? "Ready to share" : "Waiting", state: pageState }
  ];
}

function proofCaption(flow: FlowState): { title: string; sub?: string } {
  switch (flow.kind) {
    case "submitting": return { title: "Storing proof", sub: "Submitting capsule to 0G" };
    case "stored": return { title: "Proof stored", sub: shortHash(flow.capsule.storageRoot) };
    case "fallback": return { title: "Local fallback", sub: "Not stored on 0G" };
    case "error": return { title: "Proof failed", sub: "Try again" };
    default: return { title: "Ready to create", sub: "Fill the form to begin" };
  }
}

function Confirmation({ capsule, onOpen }: { capsule: ProjectCapsule; onOpen: () => void }) {
  const shareUrl = `${window.location.origin}/capsules/${capsule.id}`;
  return (
    <div className="confirmation" style={{ marginTop: 18 }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Proof stored</div>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{capsule.projectName}</div>
      </div>
      <div className="confirmation-mono"><span style={{ color: "var(--muted)" }}>root</span>{shortHash(capsule.storageRoot)}</div>
      <div className="confirmation-actions">
        <button className="btn btn-primary btn-sm" type="button" onClick={onOpen} style={{ width: "auto" }}>
          Open public page <ArrowRight size={13} />
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>
          <Copy size={13} /> Copy link
        </button>
      </div>
    </div>
  );
}

function FallbackNote({ capsule, onOpen }: { capsule: ProjectCapsule; onOpen: () => void }) {
  return (
    <div className="surface surface-pad-sm" style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, color: "var(--warn)", marginBottom: 6, fontWeight: 600 }}>Local only</div>
      <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}>The capsule was created with the local fallback. Do not submit this version to Zero Cup until 0G storage succeeds.</div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onOpen}>Open draft <ExternalLink size={12} /></button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </div>
  );
}

function Textarea({ label, value, onChange, required = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} rows={3} placeholder={placeholder} />
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => (
        <button type="button" key={opt} className={value === opt ? "on" : ""} onClick={() => onChange(opt)}>{opt}</button>
      ))}
    </div>
  );
}
