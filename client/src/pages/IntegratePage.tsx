import { ArrowRight, Copy } from "lucide-react";
import { Link } from "react-router-dom";

const hostedLink = `${window.location.origin}/?campaign=custom`;

export function IntegratePage() {
  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Integrate</span>
        <h1>Launch with one link</h1>
        <p>Send builders a hosted flow. They create Project Passports, and ZeroScout stores the proof record on 0G.</p>
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
        <Step n="01" title="Share link" body="Send the hosted flow to builders." />
        <Step n="02" title="Builders submit" body="They add repo, demo, usage, and visibility." />
        <Step n="03" title="Review proof" body="Use Projects and Compare to inspect what shipped." />
      </section>

      <section className="integrate-next">
        <div>
          <span>Coming next</span>
          <h2>Platform options</h2>
        </div>
        <div className="integrate-next-list">
          <NextItem title="Embed widget" body="Place the flow inside an existing portal." />
          <NextItem title="API" body="Create proof records from platform data." />
        </div>
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
