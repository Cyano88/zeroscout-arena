import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import type { CampaignType, CapsuleIndexRecord } from "../../../shared/types";
import { api } from "../api";
import { isRealProof, shortHash } from "../utils";

type FilterKey = "all" | "hackathon" | "cohort" | "custom";

const filters: { id: FilterKey; label: string; detail: string }[] = [
  { id: "all", label: "All", detail: "Every public Project Passport" },
  { id: "hackathon", label: "Hackathon / Ecosystem", detail: "Zero Cup, grants, ecosystem campaigns" },
  { id: "cohort", label: "University / Cohort", detail: "Grail, schools, tutors, accelerators" },
  { id: "custom", label: "Solo Builder", detail: "Independent public project proof" }
];

export function LeaderboardPage() {
  const [projects, setProjects] = useState<CapsuleIndexRecord[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    void api.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects
      .filter((item) => filter === "all" || bucketFor(item.campaignType) === filter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [projects, filter]);

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Projects</span>
        <h1>Project Passports</h1>
        <p>Browse public builds from hackathons, cohorts, universities, ecosystems, and solo builders. Unlisted projects stay hidden from this page and Compare.</p>
      </header>

      <div className="project-filter-stack">
        {filters.map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? "on" : ""} onClick={() => setFilter(item.id)}>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>

      {projects === null ? (
        <div className="empty">Loading Project Passports...</div>
      ) : filtered.length === 0 ? (
        <div className="surface empty">No public projects in this category yet.</div>
      ) : (
        <div className="project-card-list">
          {filtered.map((project) => <ProjectCard project={project} key={project.id} />)}
        </div>
      )}
    </main>
  );
}

function ProjectCard({ project }: { project: CapsuleIndexRecord }) {
  const category = categoryLabel(project.campaignType);
  const real = isRealProof(project.storageMode);
  return (
    <Link to={`/projects/${project.id}`} className="project-card-row">
      <div className={`project-category-mark ${bucketFor(project.campaignType)}`}>
        {category.initial}
      </div>
      <div className="project-card-main">
        <div className="project-card-kicker">
          <span>{category.label}</span>
          <span>{project.campaignName}</span>
          <span>{project.checkpointLabel}</span>
        </div>
        <h2>{project.projectName}</h2>
        <p>{project.tagline}</p>
      </div>
      <div className="project-card-side">
        <div className="signal-mini">
          <b>{project.scores.total}</b>
          <span>signal</span>
        </div>
        <span className={`status-tag ${real ? "ok" : "warn"}`}><span className="dot" />{real ? "Stored" : "Local"}</span>
        {project.visibility === "unlisted" ? (
          <span className="status-tag warn"><Lock size={11} />Unlisted</span>
        ) : (
          <span className="hash-mini">{shortHash(project.storageRoot)}</span>
        )}
      </div>
      <ArrowRight className="project-card-arrow" size={15} />
    </Link>
  );
}

function bucketFor(type: CampaignType): FilterKey {
  if (type === "hackathon" || type === "grant") return "hackathon";
  if (type === "cohort" || type === "accelerator" || type === "demo-day") return "cohort";
  return "custom";
}

function categoryLabel(type: CampaignType): { label: string; initial: string } {
  const bucket = bucketFor(type);
  if (bucket === "hackathon") return { label: "Hackathon / Ecosystem", initial: "HE" };
  if (bucket === "cohort") return { label: "University / Cohort", initial: "UC" };
  return { label: "Solo Builder", initial: "SB" };
}
