import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Loader2 } from "lucide-react";
import { rounds, stages, type CampaignPreset, type CapsuleIndexRecord, type ProjectCapsuleInput, type ProjectCapsule } from "../../../shared/types";
import { campaignPresets, findCampaignPreset } from "../../../shared/campaigns";
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

export function ArenaPage({ forcedCampaignId, compact = false }: { forcedCampaignId?: string; compact?: boolean }) {
  const [capsules, setCapsules] = useState<CapsuleIndexRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignPreset[]>(campaignPresets);
  const [searchParams] = useSearchParams();
  const initialCampaign = findCampaignPreset(forcedCampaignId ?? searchParams.get("campaign") ?? "zero-cup");
  const hasPresetCampaign = Boolean(forcedCampaignId ?? searchParams.get("campaign"));
  const [form, setForm] = useState<ProjectCapsuleInput>({
    ...emptyForm,
    campaignId: initialCampaign.id,
    campaignName: initialCampaign.name,
    campaignType: initialCampaign.type,
    checkpointLabel: searchParams.get("checkpoint") ?? initialCampaign.checkpointLabel,
    projectName: searchParams.get("project") ?? "",
    teamName: searchParams.get("builder") ?? searchParams.get("team") ?? "",
    repoUrl: searchParams.get("repo") ?? "",
    demoUrl: searchParams.get("demo") ?? "",
    videoDemoUrl: searchParams.get("video") ?? undefined,
    tagline: searchParams.get("tagline") ?? "",
    previousCapsuleId: searchParams.get("previous") ?? undefined,
    builderWallet: searchParams.get("wallet") ?? undefined,
    helpNeeded: searchParams.get("help") ?? undefined,
    visibility: searchParams.get("visibility") === "unlisted" ? "unlisted" : "public",
    source: forcedCampaignId ? "widget" : searchParams.toString() ? "deeplink" : "hosted"
  });
  const [selectedProgram, setSelectedProgram] = useState<string | null>(hasPresetCampaign ? initialCampaign.id : null);
  const [flow, setFlow] = useState<FlowState>({ kind: "idle" });
  const navigate = useNavigate();

  useEffect(() => {
    void api.projects().then(setCapsules).catch(() => undefined);
    void api.campaigns().then(setCampaigns).catch(() => undefined);
  }, []);

  const activeCampaign = findCampaignPreset(form.campaignId);

  const previousOptions = useMemo(
    () => capsules.filter((item) => {
      const sameCampaign = item.campaignId === activeCampaign.id;
      const sameRepo = normalizeUrl(item.repoUrl) && normalizeUrl(item.repoUrl) === normalizeUrl(form.repoUrl);
      const sameName = form.projectName.length > 1 && item.projectName.toLowerCase() === form.projectName.toLowerCase();
      return sameCampaign && (sameRepo || sameName);
    }),
    [activeCampaign.id, capsules, form.projectName, form.repoUrl]
  );

  const ready = detailsReady(form);
  const submitting = flow.kind === "submitting";
  const stored = flow.kind === "stored";
  const fallback = flow.kind === "fallback";
  const errored = flow.kind === "error";
  const hasPreviousVersion = previousOptions.length > 0;
  const previousCapsule = useMemo(
    () => capsules.find((item) => item.id === form.previousCapsuleId),
    [capsules, form.previousCapsuleId]
  );

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
      : hasPreviousVersion
        ? "Publish checkpoint update"
        : "Create Passport";

  function chooseProgram(id: string) {
    const campaign = findCampaignPreset(id);
    setForm({
      ...form,
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignType: campaign.type,
      checkpointLabel: campaign.checkpointLabel,
      round: rounds.includes(campaign.checkpointLabel as ProjectCapsuleInput["round"]) ? campaign.checkpointLabel as ProjectCapsuleInput["round"] : form.round
    });
    setSelectedProgram(campaign.id);
    setFlow({ kind: "idle" });
  }

  function goBackToPrograms() {
    setSelectedProgram(null);
    setFlow({ kind: "idle" });
  }

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Create</span>
        <h1>Create a verified project profile</h1>
        <p>Create a new proof record or update an existing project without duplicating it.</p>
      </header>

      {!selectedProgram && !compact && (
        <section className="directory-section">
          <div className="directory-head">
            <div>
              <p>Program</p>
              <h2>Choose where this project belongs</h2>
            </div>
          </div>
          <div className="directory-stack">
            {campaigns.map((campaign) => (
              <button className="directory-row" key={campaign.id} type="button" onClick={() => chooseProgram(campaign.id)}>
                <span className={`directory-mark ${markForProgram(campaign.id)}`} aria-hidden="true" />
                <div className="directory-main">
                  <h2>{campaign.name}</h2>
                  <p>{programDescription(campaign)}</p>
                </div>
                <span className="directory-action">Create <ArrowRight size={14} /></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {(selectedProgram || compact) && (
      <>
      {!compact && !forcedCampaignId && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          <button className="btn btn-ghost btn-sm" type="button" onClick={goBackToPrograms}>
            <ArrowLeft size={12} /> Back
          </button>
          {previousCapsule && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate(proofPathFromRecord(previousCapsule))}>
              Previous proof <ExternalLink size={12} />
            </button>
          )}
        </div>
      )}
      <div className={compact ? "checkout-grid compact" : "checkout-grid"}>
        <section className="surface surface-pad">
          <form className="checkout-form" onSubmit={submit}>
            <div className="selected-program-strip">
              <span className={`directory-mark ${markForProgram(activeCampaign.id)}`} aria-hidden="true" />
              <div>
                <label>Program</label>
                <strong>{activeCampaign.name}</strong>
              </div>
            </div>

            <div className="field-row two">
              <Field label="Project name" value={form.projectName} onChange={(v) => setForm({ ...form, projectName: v })} placeholder="Your product name, not the program" required maxLength={90} />
              <Field label="Builder or team" value={form.teamName} onChange={(v) => setForm({ ...form, teamName: v })} placeholder="Your team" required maxLength={90} />
            </div>

            <Field label="One-line outcome" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} placeholder="What should someone understand in one sentence?" required maxLength={140} />

            <div className="field-row two">
              <Field label="Repo URL" type="url" value={form.repoUrl} onChange={(v) => setForm({ ...form, repoUrl: v })} placeholder="https://github.com/..." required />
              <Field label="Live demo URL" type="url" value={form.demoUrl} onChange={(v) => setForm({ ...form, demoUrl: v })} placeholder="https://..." required />
            </div>

            <Field label="Video walkthrough URL" type="url" value={form.videoDemoUrl ?? ""} onChange={(v) => setForm({ ...form, videoDemoUrl: v || undefined })} placeholder="YouTube or Loom link" />

            <div className="field">
              <label>Checkpoint</label>
              <Segmented
                value={form.checkpointLabel ?? form.round}
                options={activeCampaign.checkpoints}
                onChange={(v) => setForm({
                  ...form,
                  checkpointLabel: v,
                  round: rounds.includes(v as ProjectCapsuleInput["round"]) ? v as ProjectCapsuleInput["round"] : form.round
                })}
              />
            </div>

            <div className="field">
              <label>Stage</label>
              <Segmented value={form.stage} options={[...stages]} onChange={(v) => setForm({ ...form, stage: v as ProjectCapsuleInput["stage"] })} />
            </div>

            <div className="field">
              <label>Visibility</label>
              <Segmented
                value={form.visibility ?? "public"}
                options={["public", "unlisted"]}
                labels={{ public: "Public", unlisted: "Unlisted" }}
                onChange={(v) => setForm({ ...form, visibility: v as ProjectCapsuleInput["visibility"] })}
              />
              <span className="hint">{form.visibility === "unlisted" ? "Hidden from Projects and Compare. Share by direct link only." : "Listed publicly and available for Compare."}</span>
            </div>

            {previousOptions.length > 0 && (
              <div className="field">
                <label>Update an existing passport</label>
                <select value={form.previousCapsuleId ?? ""} onChange={(e) => setForm({ ...form, previousCapsuleId: e.target.value || undefined })}>
                  <option value="">Auto-link latest matching repo</option>
                  {previousOptions.map((item) => (
                    <option key={item.id} value={item.id}>v{item.versionNumber ?? 1} - {item.projectName} - {item.checkpointLabel ?? item.round}</option>
                  ))}
                </select>
                <span className="hint">Same repo and program become a version history, not duplicate listings.</span>
              </div>
            )}

            <Textarea label="What does the product do?" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Who is it for, and what do they get?" required maxLength={4000} />
            <Textarea label="What does 0G power?" value={form.ogUsageClaims} onChange={(v) => setForm({ ...form, ogUsageClaims: v })} placeholder="Example: stores the public proof record, runs AI analysis, or verifies progress." required maxLength={3000} />
            <Textarea label="What should people remember?" value={form.pitchNotes ?? ""} onChange={(v) => setForm({ ...form, pitchNotes: v })} placeholder="Write the sentence you want users, mentors, or voters to repeat." maxLength={3000} />
            <Textarea label="What do you need next?" value={form.helpNeeded ?? ""} onChange={(v) => setForm({ ...form, helpNeeded: v })} placeholder="Example: pilots, users, funding, mentors, design partners." maxLength={240} />

            {errored && <div className="error-banner">{flow.message}</div>}
            {fallback && (
              <div className="error-banner" style={{ color: "var(--warn)", borderColor: "color-mix(in srgb, var(--warn) 50%, var(--line))", background: "color-mix(in srgb, var(--warn) 8%, transparent)" }}>
                Local fallback used - proof was not stored on 0G. Check your 0G keys before sharing this proof.
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
          {stored && <Confirmation capsule={flow.capsule} onOpen={() => navigate(proofPath(flow.capsule))} />}
          {fallback && <FallbackNote capsule={flow.capsule} onOpen={() => navigate(`/projects/${flow.capsule.id}`)} />}
        </aside>
      </div>

      </>
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
    { label: "Project Passport", sub: stored ? "Ready to share" : "Waiting", state: pageState }
  ];
}

function proofCaption(flow: FlowState): { title: string; sub?: string } {
  switch (flow.kind) {
    case "submitting": return { title: "Storing proof", sub: "Submitting passport to 0G" };
    case "stored": return { title: "Proof stored", sub: shortHash(flow.capsule.storageRoot) };
    case "fallback": return { title: "Local fallback", sub: "Not stored on 0G" };
    case "error": return { title: "Proof failed", sub: "Try again" };
    default: return { title: "Ready to create", sub: "Fill the form to begin" };
  }
}

function Confirmation({ capsule, onOpen }: { capsule: ProjectCapsule; onOpen: () => void }) {
  const shareUrl = `${window.location.origin}${proofPath(capsule)}`;
  return (
    <div className="confirmation" style={{ marginTop: 18 }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Proof stored</div>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{capsule.projectName}</div>
      </div>
      <div className="confirmation-mono"><span style={{ color: "var(--muted)" }}>root</span>{shortHash(capsule.storageRoot)}</div>
      <div className="confirmation-actions">
        <button className="btn btn-primary btn-sm" type="button" onClick={onOpen} style={{ width: "auto" }}>
          Open Project Passport <ArrowRight size={13} />
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>
          <Copy size={13} /> Copy link
        </button>
      </div>
    </div>
  );
}

function proofPath(capsule: ProjectCapsule): string {
  const params = new URLSearchParams({ root: capsule.storageRoot });
  if (capsule.storageTxHash) params.set("tx", capsule.storageTxHash);
  return `/projects/${capsule.id}?${params.toString()}`;
}

function proofPathFromRecord(capsule: CapsuleIndexRecord): string {
  const params = new URLSearchParams({ root: capsule.storageRoot });
  if (capsule.storageTxHash) params.set("tx", capsule.storageTxHash);
  return `/projects/${capsule.id}?${params.toString()}`;
}

function FallbackNote({ capsule, onOpen }: { capsule: ProjectCapsule; onOpen: () => void }) {
  return (
    <div className="surface surface-pad-sm" style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, color: "var(--warn)", marginBottom: 6, fontWeight: 600 }}>Local only</div>
      <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}>This passport was created with the local fallback. Do not share it as verified proof until 0G storage succeeds.</div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onOpen}>Open draft <ExternalLink size={12} /></button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "", maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; maxLength?: number }) {
  return (
    <div className="field">
      <FieldHead label={label} value={value} maxLength={maxLength} />
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} maxLength={maxLength} />
    </div>
  );
}

function Textarea({ label, value, onChange, required = false, placeholder = "", maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; maxLength?: number }) {
  return (
    <div className="field">
      <FieldHead label={label} value={value} maxLength={maxLength} />
      <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} rows={3} placeholder={placeholder} maxLength={maxLength} />
    </div>
  );
}

function FieldHead({ label, value, maxLength }: { label: string; value: string; maxLength?: number }) {
  return (
    <div className="field-head">
      <label>{label}</label>
      {maxLength && <span>{value.length}/{maxLength}</span>}
    </div>
  );
}

function Segmented({ value, options, labels, onChange }: { value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => (
        <button type="button" key={opt} className={value === opt ? "on" : ""} onClick={() => onChange(opt)}>{labels?.[opt] ?? opt}</button>
      ))}
    </div>
  );
}

function markForProgram(id: string): "og" | "grail" | "zs" {
  if (id === "zero-cup") return "og";
  if (id === "grail-builders-university") return "grail";
  return "zs";
}

function programDescription(campaign: CampaignPreset): string {
  if (campaign.id === "zero-cup") return "Hackathons, grants, and ecosystem competitions.";
  if (campaign.id === "grail-builders-university") return "Universities, cohorts, tutors, and accelerators.";
  return "Independent builders creating public or unlisted proof.";
}

function normalizeUrl(value?: string): string {
  return (value ?? "").trim().replace(/\/$/, "").toLowerCase();
}
