import { ArrowRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const xUrl = "https://x.com/ZeroScoutApp";

export function DocumentationPage() {
  return (
    <main className="docs-shell">
      <section className="docs-hero">
        <span className="eyebrow">Documentation</span>
        <h1>ZeroScout turns builder progress into proof people can inspect.</h1>
        <p>
          Create Project Passports, review demo videos, compare public builds, and plug ZeroScout into cohorts,
          hackathons, grant programs, universities, and builder platforms.
        </p>
        <div className="docs-hero-actions">
          <Link className="btn btn-primary btn-sm" to="/">
            Create passport <ArrowRight size={13} />
          </Link>
          <Link className="btn btn-ghost btn-sm" to="/integrate">
            Integrate ZeroScout
          </Link>
          <a className="btn btn-ghost btn-sm" href={xUrl} target="_blank" rel="noreferrer">
            X <ExternalLink size={13} />
          </a>
        </div>
      </section>

      <section className="docs-index surface">
        <a href="#product">Product</a>
        <a href="#integrations">Integrations</a>
        <a href="#api">API</a>
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
        <a href="#roadmap">Roadmap</a>
      </section>

      <section className="docs-grid">
        <DocCard eyebrow="Product" title="What builders get" id="product">
          <p>
            A builder submits a repo, live demo, project notes, and 0G usage. ZeroScout returns a public Project Passport
            with AI feedback, readiness signal, next steps, share copy, proof links, and optional video review.
          </p>
          <ul>
            <li>Project Passport for sharing with mentors, voters, sponsors, and users.</li>
            <li>Update flow that links new milestones to the same project instead of creating duplicates.</li>
            <li>Public or unlisted visibility for early projects that are not ready for discovery.</li>
          </ul>
        </DocCard>

        <DocCard eyebrow="Proof" title="What 0G stores">
          <p>
            The canonical Project Passport record is stored on 0G. The app keeps a lightweight index for discovery, but
            the proof page and JSON record point back to stored roots and content hashes.
          </p>
          <ul>
            <li>Project metadata, AI output, scores, risks, next steps, and share copy.</li>
            <li>Video review artifacts when a walkthrough is reviewed or uploaded.</li>
            <li>Registry transaction fields when chain receipts are available.</li>
          </ul>
        </DocCard>

        <DocCard eyebrow="Integrations" title="Hosted link and embedded form" id="integrations">
          <p>
            The fastest integration is a hosted builder link. Programs can also embed the Project Passport form inside a
            university portal, cohort dashboard, hackathon page, or grant form.
          </p>
          <pre>{`Hosted link
https://zeroscout.app/?campaign=custom

Embedded form
<iframe src="https://zeroscout.app/embed/custom" width="100%" height="760" style="border:0"></iframe>`}</pre>
        </DocCard>

        <DocCard eyebrow="API" title="Server-side integrations" id="api">
          <p>
            Use the API when your platform already collects builder data, user videos, or structured product data. API
            keys must stay on your backend and are funded with capped credits so usage cannot run forever.
          </p>
          <pre>{`ZEROSCOUT_API_URL=https://zeroscout.app
ZEROSCOUT_INTEGRATION_SECRET=zs_live_key_from_dashboard

Authorization: Bearer $ZEROSCOUT_INTEGRATION_SECRET

POST /api/integrations/capsules
POST /api/integrations/video-score
POST /api/integrations/intelligence`}</pre>
          <Link className="docs-inline-link" to="/dashboard">Open API dashboard <ArrowRight size={13} /></Link>
        </DocCard>

        <DocCard eyebrow="Custom intelligence" title="Bring your own data">
          <p>
            Platforms can send their own structured data to ZeroScout for an AI-generated operator brief. ZeroScout does
            not fetch live market data for you; it analyzes the data your backend supplies and stores the result as a
            proof artifact.
          </p>
          <pre>{`POST /api/integrations/intelligence
{
  "productType": "prediction-market",
  "analysisType": "lp-market-alpha",
  "objective": "Find useful LP signals from supplied market data",
  "data": { "markets": [], "liquidity": [], "volume": [] },
  "includeClaudeReview": true
}`}</pre>
        </DocCard>

        <DocCard eyebrow="Milestones" title="What is live now">
          <ul>
            <li>0G-backed Project Passport creation and public profile pages.</li>
            <li>Project update/version history for the same repo and program.</li>
            <li>Video walkthrough review through link review or upload.</li>
            <li>Compare mode for public Project Passports.</li>
            <li>Hosted, embedded, server API, and custom intelligence integration paths.</li>
            <li>Credit dashboard for capped platform usage.</li>
          </ul>
        </DocCard>

        <DocCard eyebrow="Partnerships" title="Who ZeroScout is for">
          <p>
            ZeroScout is built for builder programs that need proof, review, and progress tracking without rebuilding an
            AI and 0G integration layer from scratch.
          </p>
          <ul>
            <li>Hackathons and ecosystem campaigns.</li>
            <li>Universities, cohort programs, tutors, and accelerators.</li>
            <li>Grant teams, demo days, creator programs, and distribution platforms.</li>
          </ul>
        </DocCard>

        <DocCard eyebrow="Privacy" title="Privacy notice" id="privacy">
          <p>
            Public Project Passports are meant to be shared. Unlisted passports are hidden from public discovery and
            compare pages, but anyone with the direct link may still view the record. Do not submit secrets, private keys,
            unreleased source code, or confidential customer data.
          </p>
          <p>
            Wallet and login flows may use Privy when enabled. Review Privy's policies before using embedded wallet or
            email login features.
          </p>
          <div className="docs-link-row">
            <a href="https://www.privy.io/privacy" target="_blank" rel="noreferrer">Privy privacy <ExternalLink size={13} /></a>
            <a href="https://www.privy.io/terms" target="_blank" rel="noreferrer">Privy terms <ExternalLink size={13} /></a>
          </div>
        </DocCard>

        <DocCard eyebrow="Terms" title="Terms of use" id="terms">
          <p>
            ZeroScout provides AI scouting signals and proof records. It is not a decision-maker, legal reviewer,
            financial advisor, or guarantee of funding, prizes, acceptance, or community support.
          </p>
          <ul>
            <li>Only submit projects and media you have the right to share.</li>
            <li>Do not use ZeroScout to misrepresent what a project does.</li>
            <li>API users are responsible for keeping keys private and funding their own usage.</li>
            <li>AI output should be reviewed by humans before public or business decisions.</li>
          </ul>
        </DocCard>

        <DocCard eyebrow="Roadmap" title="Where this is going next" id="roadmap">
          <ul>
            <li>Cleaner organization dashboards for cohorts, hackathons, and grants.</li>
            <li>Richer repo ingestion and milestone diffs.</li>
            <li>More reliable video review queues and score callbacks for platforms.</li>
            <li>Share cards, program analytics, and public partner pages.</li>
            <li>Stronger wallet and ownership flows after Privy is fully configured.</li>
          </ul>
        </DocCard>
      </section>
    </main>
  );
}

function DocCard({ eyebrow, title, id, children }: { eyebrow: string; title: string; id?: string; children: ReactNode }) {
  return (
    <article className="docs-card surface" id={id}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {children}
    </article>
  );
}
