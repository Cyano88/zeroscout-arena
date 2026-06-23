import { ArrowRight, Copy } from "lucide-react";
import { Link } from "react-router-dom";

const hostedLink = `${window.location.origin}/?campaign=custom`;
const embedSnippet = `<iframe src="${window.location.origin}/embed/custom" width="100%" height="760" style="border:0"></iframe>`;
const apiEndpoint = `${window.location.origin}/api/integrations/capsules`;

export function IntegratePage() {
  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Integrate</span>
        <h1>Add Project Passports to your builder program</h1>
        <p>ZeroScout gives any organization a hosted proof flow, embeddable widget, and API path for collecting AI-reviewed builder progress stored on 0G.</p>
      </header>

      <section className="integrate-flow">
        <Step n="01" title="Pick your program" body="Hackathon, ecosystem grant, cohort, university, accelerator, demo day, or solo builder track." />
        <Step n="02" title="Share a proof link" body="Send builders a campaign link that opens a clean Project Passport form with your program context." />
        <Step n="03" title="Collect verified progress" body="Builders submit repo, demo, notes, and 0G usage. ZeroScout stores the canonical proof capsule on 0G." />
        <Step n="04" title="Review and compare" body="Use campaign dashboards, Project Passport pages, and compare mode to see who shipped and what needs help." />
      </section>

      <section className="integrate-grid">
        <IntegrationCard
          title="Hosted link"
          label="Fastest start"
          body="Use this when you want to launch today. Send one URL to builders and collect Project Passports immediately."
          value={hostedLink}
          cta="Open create flow"
          to="/?campaign=custom"
        />
        <IntegrationCard
          title="Embed widget"
          label="Portal ready"
          body="Use this inside a university portal, hackathon page, grant form, or cohort dashboard."
          value={embedSnippet}
          cta="Preview widget"
          to="/embed/custom"
        />
        <IntegrationCard
          title="API"
          label="Platform path"
          body="Use this when your platform already has builder data and wants to create 0G-backed proof records programmatically."
          value={apiEndpoint}
          cta="Read proof docs"
          to="/verify"
        />
      </section>

      <section className="surface surface-pad" style={{ marginTop: 28 }}>
        <h2 className="section-title">Who this is for</h2>
        <div className="usecase-grid">
          <UseCase title="Hackathons / ecosystems" body="Collect proof pages from projects applying for grants, tracks, or tournament rounds." />
          <UseCase title="Universities / cohorts" body="Make every student submit weekly proof checkpoints mentors can review quickly." />
          <UseCase title="Accelerators / demo days" body="Create public project profiles that sponsors, partners, and investors can inspect." />
          <UseCase title="Solo builders" body="Give independent builders a proof trail they can reuse for grants, launches, and traction updates." />
        </div>
      </section>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="integrate-step">
      <span>{n}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function IntegrationCard({ title, label, body, value, cta, to }: { title: string; label: string; body: string; value: string; cta: string; to: string }) {
  return (
    <article className="surface surface-pad integration-card">
      <span className="status-tag"><span className="dot" />{label}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="integration-copy">
        <code>{value}</code>
        <button className="icon-btn" type="button" onClick={() => navigator.clipboard.writeText(value)} title="Copy">
          <Copy size={13} />
        </button>
      </div>
      <Link className="btn btn-primary btn-sm" to={to}>
        {cta} <ArrowRight size={13} />
      </Link>
    </article>
  );
}

function UseCase({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
