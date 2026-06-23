import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { CapsuleIndexRecord, ProjectCapsule, ScoreSet } from "../../shared/types";
import { scoreRows, shortHash, isRealProof } from "./utils";

export type ProofState = "pending" | "active" | "complete" | "error";

export function ProofLogo({ state, size = "md", caption }: { state: ProofState; size?: "xs" | "sm" | "md"; caption?: { title: string; sub?: string } }) {
  const sizeClass = size === "md" ? "" : ` ${size}`;
  return (
    <div className="proof-logo-wrap">
      <div className={`proof-logo${sizeClass} ${state}`} aria-label="0G proof status" role="img" />
      {caption && (
        <div className="proof-logo-caption">
          <strong>{caption.title}</strong>
          {caption.sub && <span>{caption.sub}</span>}
        </div>
      )}
    </div>
  );
}

export interface ProofRailStep {
  label: string;
  sub?: string;
  state: ProofState;
}

export function ProofRail({ steps, footer }: { steps: ProofRailStep[]; footer?: React.ReactNode }) {
  return (
    <div className="surface proof-rail">
      <div className="proof-rail-head">
        <h3>Proof status</h3>
      </div>
      {steps.map((step, index) => (
        <div className={`proof-step ${step.state}`} key={step.label}>
          <span className="dot">{step.state === "complete" ? <Check size={12} strokeWidth={3} /> : index + 1}</span>
          <div>
            <div className="label">{step.label}</div>
            {step.sub && <span className="sub">{step.sub}</span>}
          </div>
        </div>
      ))}
      {footer}
    </div>
  );
}

export function ScoreStrip({ scores }: { scores: ScoreSet }) {
  return (
    <div className="score-strip">
      {scoreRows(scores).map(([label, value, max]) => {
        const pct = Math.max(0, Math.min(100, (value / max) * 100));
        return (
          <div className="row" key={label}>
            <div className="row-top"><span>{label}</span><em>{value}/{max}</em></div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  return (
    <button className="icon-btn" type="button" title={label ?? "Copy"} onClick={() => navigator.clipboard.writeText(value)}>
      <Copy size={13} />
    </button>
  );
}

export function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a className="btn btn-ghost btn-sm" href={href} target="_blank" rel="noreferrer">
      {label} <ExternalLink size={13} />
    </a>
  );
}

export function TaskList({ items }: { items: string[] }) {
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item}><Check size={14} strokeWidth={2.4} /><span>{item}</span></li>
      ))}
    </ul>
  );
}

export function ProofTag({ record }: { record: Pick<ProjectCapsule | CapsuleIndexRecord, "storageMode" | "storageRoot"> }) {
  const real = isRealProof(record.storageMode);
  return (
    <span className={`status-tag ${real ? "ok" : "warn"}`} title={real ? "Stored on 0G" : "Local fallback"}>
      <span className="dot" />
      {real ? "Stored" : "Local"}
      <span style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{shortHash(record.storageRoot)}</span>
    </span>
  );
}

export function ProjectRow({ capsule }: { capsule: CapsuleIndexRecord }) {
  const pct = Math.max(0, Math.min(100, capsule.scores.total));
  const real = isRealProof(capsule.storageMode);
  return (
    <Link className="row" to={`/projects/${capsule.id}`}>
      <div className="name">
        <strong>{capsule.projectName}</strong>
        <span>{capsule.tagline}</span>
      </div>
      <div className="builder">{capsule.teamName}</div>
      <div className="round">{capsule.checkpointLabel ?? capsule.round}</div>
      <div className="signal">
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <em style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", fontStyle: "normal" }}>{capsule.scores.total}</em>
      </div>
      <div>
        <span className={`status-tag ${real ? "ok" : "warn"}`}><span className="dot" />{real ? "Stored" : "Local"}</span>
      </div>
    </Link>
  );
}
