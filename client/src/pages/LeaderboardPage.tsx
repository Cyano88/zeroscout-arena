import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import type { CampaignPreset, CampaignType, CapsuleIndexRecord } from "../../../shared/types";
import { api } from "../api";
import { isRealProof, shortHash } from "../utils";

type CategoryId = "hackathon" | "cohort" | "custom";

const categories: { id: CategoryId; title: string; subtitle: string; mark: "og" | "grail" | "zs" }[] = [
  { id: "hackathon", title: "Hackathon / Ecosystem", subtitle: "Zero Cup, grants, ecosystem campaigns", mark: "og" },
  { id: "cohort", title: "University / Cohort", subtitle: "Grail, schools, tutors, accelerators", mark: "grail" },
  { id: "custom", title: "Solo Builder", subtitle: "Independent public project proof", mark: "zs" }
];

export function LeaderboardPage() {
  const [projects, setProjects] = useState<CapsuleIndexRecord[] | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignPreset[]>([]);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);

  useEffect(() => {
    void api.projects().then(setProjects).catch(() => setProjects([]));
    void api.campaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  const programs = useMemo(() => {
    if (!category) return [];
    return campaigns.filter((campaign) => bucketFor(campaign.type) === category);
  }, [campaigns, category]);

  const program = useMemo(() => campaigns.find((item) => item.id === programId) ?? null, [campaigns, programId]);
  const listedProjects = useMemo(() => {
    if (!projects || !programId) return [];
    return projects.filter((project) => project.campaignId === programId);
  }, [projects, programId]);

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Projects</span>
        <h1>Project Passports</h1>
        <p>Browse public builds by source.</p>
      </header>

      {!category && (
        <DirectorySection eyebrow="Public sources" title="Choose where the project came from">
          {categories.map((item) => (
            <button className="directory-row" key={item.id} type="button" onClick={() => { setCategory(item.id); setProgramId(null); }}>
              <DirectoryMark kind={item.mark} />
              <div className="directory-main">
                <h2>{item.title}</h2>
                <p>{item.subtitle}</p>
              </div>
              <span className="directory-action">View <ArrowRight size={14} /></span>
            </button>
          ))}
        </DirectorySection>
      )}

      {category && !programId && (
        <DirectorySection
          eyebrow={categoryTitle(category)}
          title="Listed ecosystems and programs"
          back={() => setCategory(null)}
        >
          {programs.map((item) => (
            <button className="directory-row" key={item.id} type="button" onClick={() => setProgramId(item.id)}>
              <DirectoryMark kind={markForProgram(item.id, category)} />
              <div className="directory-main">
                <h2>{item.name}</h2>
                <p>{item.description}</p>
              </div>
              <span className="directory-action">View <ArrowRight size={14} /></span>
            </button>
          ))}
        </DirectorySection>
      )}

      {category && program && (
        <DirectorySection
          eyebrow={categoryTitle(category)}
          title={program.name}
          back={() => setProgramId(null)}
        >
          {listedProjects.length === 0 ? (
            <div className="directory-empty">
              <p>No public projects listed yet.</p>
            </div>
          ) : (
            listedProjects.map((project) => <ProjectRow project={project} key={project.id} />)
          )}
          <div className="directory-cta">
            <div>
              <h3>Building with this ecosystem?</h3>
              <p>Create a Project Passport for this program and decide whether it should be public or unlisted.</p>
            </div>
            <Link className="btn btn-primary btn-sm" to={`/?campaign=${program.id}`}>
              Create yours <ArrowRight size={13} />
            </Link>
          </div>
        </DirectorySection>
      )}
    </main>
  );
}

function DirectorySection({ eyebrow, title, back, children }: { eyebrow: string; title: string; back?: () => void; children: React.ReactNode }) {
  return (
    <section className="directory-section">
      <div className="directory-head">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {back && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={back}>
            <ArrowLeft size={12} /> Back
          </button>
        )}
      </div>
      <div className="directory-stack">{children}</div>
    </section>
  );
}

function DirectoryMark({ kind }: { kind: "og" | "grail" | "zs" }) {
  return <span className={`directory-mark ${kind}`} aria-hidden="true" />;
}

function ProjectRow({ project }: { project: CapsuleIndexRecord }) {
  const real = isRealProof(project.storageMode);
  return (
    <Link className="directory-row project" to={`/projects/${project.id}`}>
      <DirectoryMark kind={markForProgram(project.campaignId, bucketFor(project.campaignType))} />
      <div className="directory-main">
        <h2>{project.projectName}</h2>
        <p>{project.teamName} - {project.checkpointLabel}</p>
      </div>
      <span className="directory-score">{project.scores.total}</span>
      <div className="directory-proof">
        <span className={`status-tag ${real ? "ok" : "warn"}`}><span className="dot" />{real ? "Stored" : "Local"}</span>
        {project.visibility === "unlisted" ? <span className="status-tag warn"><Lock size={11} />Unlisted</span> : <span>{shortHash(project.storageRoot)}</span>}
      </div>
      <span className="directory-action">View <ArrowRight size={14} /></span>
    </Link>
  );
}

function bucketFor(type: CampaignType): CategoryId {
  if (type === "hackathon" || type === "grant") return "hackathon";
  if (type === "cohort" || type === "accelerator" || type === "demo-day") return "cohort";
  return "custom";
}

function categoryTitle(category: CategoryId): string {
  if (category === "hackathon") return "Hackathon / Ecosystem";
  if (category === "cohort") return "University / Cohort";
  return "Solo Builder";
}

function markForProgram(id: string, category: CategoryId): "og" | "grail" | "zs" {
  if (id === "zero-cup") return "og";
  if (id === "grail-builders-university") return "grail";
  if (category === "hackathon") return "og";
  if (category === "cohort") return "grail";
  return "zs";
}
