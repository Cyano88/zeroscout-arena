import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { rounds, stages, type CapsuleIndexRecord, type ProjectCapsuleInput } from "../../../shared/types";
import { api } from "../api";
import { CapsuleCard } from "../components";
import { deadlineCopy } from "../utils";

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

export function ArenaPage() {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[]>([]);
  const [form, setForm] = useState<ProjectCapsuleInput>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    void api.capsules().then(setCapsules);
  }, []);

  const previousOptions = useMemo(
    () => capsules.filter((item) => item.projectName.toLowerCase() === form.projectName.toLowerCase() || item.teamName.toLowerCase() === form.teamName.toLowerCase()),
    [capsules, form.projectName, form.teamName]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const capsule = await api.createCapsule(form);
      navigate(`/capsules/${capsule.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project profile creation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-page">
      <section className="portal-hero">
        <div className="brand-rule">
          <span />
          <p>Project Intelligence</p>
          <span />
        </div>
        <h1>ZeroScout</h1>
        <p className="subtitle">Create a clean project page with a brief, stored record, next steps, and share copy.</p>
        <div className="deadline-line">
          <span>{deadlineCopy()}</span>
        </div>
      </section>

      <section className="portal-panel">
        <div className="panel-heading">
          <p>Create</p>
          <span>Project page</span>
        </div>

        <form onSubmit={submit} className="capsule-form">
          <div className="two-col">
            <Field label="Project name" value={form.projectName} onChange={(v) => setForm({ ...form, projectName: v })} placeholder="ZeroScout Arena" required />
            <Field label="Team or builder" value={form.teamName} onChange={(v) => setForm({ ...form, teamName: v })} placeholder="Your team" required />
          </div>

          <Field label="One-line promise" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} placeholder="What should a user understand in one sentence?" required />

          <div className="two-col">
            <Field label="Repo URL" type="url" value={form.repoUrl} onChange={(v) => setForm({ ...form, repoUrl: v })} placeholder="https://github.com/..." required />
            <Field label="Demo URL" type="url" value={form.demoUrl} onChange={(v) => setForm({ ...form, demoUrl: v })} placeholder="https://..." required />
          </div>

          <div className="three-col">
            <Select label="Round" value={form.round} options={rounds} onChange={(v) => setForm({ ...form, round: v as ProjectCapsuleInput["round"] })} />
            <Select label="Stage" value={form.stage} options={stages} onChange={(v) => setForm({ ...form, stage: v as ProjectCapsuleInput["stage"] })} />
            <Select label="Previous version" value={form.previousCapsuleId ?? ""} options={["", ...previousOptions.map((item) => item.id)]} onChange={(v) => setForm({ ...form, previousCapsuleId: v || undefined })} />
          </div>

          <Textarea label="What does the product do for users?" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Explain the product in plain language." required />
          <Textarea label="What does 0G power?" value={form.ogUsageClaims} onChange={(v) => setForm({ ...form, ogUsageClaims: v })} placeholder="Storage, compute, chain, retrieval, or agent memory." required />
          <Textarea label="What should people remember or share?" value={form.pitchNotes ?? ""} onChange={(v) => setForm({ ...form, pitchNotes: v })} placeholder="Write the message you want voters, users, or backers to repeat." />

          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" disabled={loading}>
            {loading && <Loader2 className="spin" size={13} />}
            Create Page
          </button>
        </form>
      </section>

      <section className="section-block">
        <div className="section-headline split">
          <div>
            <p>Recent</p>
            <h2>Projects</h2>
          </div>
          <Link to="/leaderboard">View all</Link>
        </div>
        <div className="card-grid">
          {capsules.slice(0, 6).map((capsule) => <CapsuleCard capsule={capsule} key={capsule.id} />)}
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} /></label>;
}

function Textarea({ label, value, onChange, required = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <label>{label}<textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} rows={3} placeholder={placeholder} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option || "None"}</option>)}</select></label>;
}
