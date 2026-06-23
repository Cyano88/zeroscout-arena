import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { CapsuleIndexRecord, ProjectCapsule, ScoreSet } from "../../shared/types";
import { scoreRows, shortHash } from "./utils";

export function ProofBadge({ capsule }: { capsule: Pick<ProjectCapsule | CapsuleIndexRecord, "storageMode" | "network" | "storageRoot"> }) {
  const real = capsule.storageMode !== "local-dev-fallback";
  return (
    <div className={real ? "proof-badge" : "proof-badge warning"}>
      <span>{real ? "Stored" : "Local"}</span>
      <code>{shortHash(capsule.storageRoot)}</code>
    </div>
  );
}

export function ScoreBars({ scores }: { scores: ScoreSet }) {
  return (
    <div className="score-bars">
      <div className="total-score">
        <span>{scores.total}</span>
        <small>Strength</small>
      </div>
      {scoreRows(scores).map(([label, value, max]) => (
        <div className="score-row" key={label}>
          <div><span>{label}</span><b>{value}/{max}</b></div>
          <meter min={0} max={max} value={value} />
        </div>
      ))}
    </div>
  );
}

export function CapsuleCard({ capsule }: { capsule: CapsuleIndexRecord }) {
  return (
    <Link className="capsule-card" to={`/capsules/${capsule.id}`}>
      <div className="card-topline">
        <span>{capsule.round}</span>
        <b>{capsule.scores.total}<small>/100</small></b>
      </div>
      <h3>{capsule.projectName}</h3>
      <p>{capsule.tagline}</p>
      <div className="card-footer">
        <span>{capsule.teamName}</span>
        <span>{capsule.storageMode === "local-dev-fallback" ? "Local" : "Stored"}</span>
      </div>
    </Link>
  );
}

export function CopyButton({ value }: { value: string }) {
  return (
    <button className="icon-button" onClick={() => navigator.clipboard.writeText(value)} type="button" title="Copy">
      <Copy size={16} />
    </button>
  );
}

export function ExternalProofLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="small-link" href={href} target="_blank" rel="noreferrer">
      {label} <ExternalLink size={13} />
    </a>
  );
}

export function TaskList({ items }: { items: string[] }) {
  return (
    <ul className="task-list">
      {items.map((item) => (
        <li key={item}><Check size={15} /> {item}</li>
      ))}
    </ul>
  );
}
