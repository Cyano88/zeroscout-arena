import { ArrowRight, Copy, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

const hostedLink = `${window.location.origin}/?campaign=custom`;

export function IntegratePage() {
  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Integrate</span>
        <h1>Choose the simplest integration</h1>
        <p>Use a hosted flow when builders should submit directly. Use an API key when your platform already has the user experience and wants ZeroScout proof, scoring, and 0G storage behind it.</p>
      </header>

      <section className="integrate-primary">
        <div>
          <span className="status-tag"><span className="dot" />Live today</span>
          <h2>Hosted link</h2>
          <p>Start without engineering work. Share this URL with builders and review public Project Passports as they arrive.</p>
        </div>
        <div className="integrate-link-box">
          <code>{hostedLink}</code>
          <button className="icon-btn" type="button" onClick={() => navigator.clipboard.writeText(hostedLink)} title="Copy">
            <Copy size={13} />
          </button>
        </div>
        <div className="integrate-actions">
          <Link className="btn btn-primary btn-sm" to="/?campaign=custom">
            Open link <ArrowRight size={13} />
          </Link>
          <Link className="btn btn-ghost btn-sm" to="/projects">
            Projects
          </Link>
        </div>
      </section>

      <section className="integrate-steps">
        <Step n="01" title="Hosted link" body="No env. Send one URL to builders, students, or applicants." />
        <Step n="02" title="Embed widget" body="No env for public forms. Place ZeroScout inside a portal page." />
        <Step n="03" title="API key" body="Backend env required. Best for native scoring, private records, and metered usage." />
      </section>

      <section className="integrate-next">
        <div>
          <span>For platforms</span>
          <h2>Fund a capped API key</h2>
        </div>
        <div className="integrate-next-list">
          <NextItem title="Widget" body="Use this for university portals, cohort pages, and hackathon forms." />
          <NextItem title="API key" body="Use this when your backend uploads videos, creates passports, or needs private program records." />
        </div>
        <Link className="btn btn-primary btn-sm" to="/dashboard">
          <KeyRound size={13} /> Open API dashboard
        </Link>
      </section>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="integrate-step-line">
      <span>{n}</span>
      <div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
    </div>
  );
}

function NextItem({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
