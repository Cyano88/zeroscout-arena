import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Copy } from "lucide-react";
import type { CampaignPreset, CapsuleIndexRecord } from "../../../shared/types";
import { api } from "../api";
import { ProjectRow } from "../components";

type CampaignSummary = CampaignPreset & {
  profileCount: number;
  storedProofs: number;
  latestProfiles: CapsuleIndexRecord[];
};

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignPreset[]>([]);

  useEffect(() => {
    void api.campaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">Campaigns</span>
        <h1>Launch a proof flow for any builder program</h1>
        <p>Use a hosted link today. Embed and API integrations share the same 0G-backed Project Passport system.</p>
      </header>

      <div className="campaign-grid">
        {campaigns.map((campaign) => (
          <Link className="surface surface-pad campaign-tile" to={`/campaigns/${campaign.id}`} key={campaign.id}>
            <div>
              <span className="status-tag"><span className="dot" />{campaign.type}</span>
              <h2>{campaign.name}</h2>
              <p>{campaign.description}</p>
            </div>
            <div className="campaign-actions">
              <span>{campaign.checkpoints.length} checkpoints</span>
              <ArrowRight size={15} />
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

export function CampaignDetailPage() {
  const { id = "zero-cup" } = useParams();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [profiles, setProfiles] = useState<CapsuleIndexRecord[]>([]);

  useEffect(() => {
    void api.campaign(id).then(setCampaign).catch(() => setCampaign(null));
    void api.campaignCapsules(id).then(setProfiles).catch(() => setProfiles([]));
  }, [id]);

  const links = useMemo(() => {
    const origin = window.location.origin;
    return {
      hosted: `${origin}/?campaign=${id}`,
      embed: `<iframe src="${origin}/embed/${id}" width="100%" height="760" style="border:0"></iframe>`,
      api: `${origin}/api/campaigns/${id}/capsules`
    };
  }, [id]);

  if (!campaign) {
    return <main className="page"><div className="empty">Loading campaign...</div></main>;
  }

  return (
    <main className="page">
      <header className="page-heading">
        <span className="eyebrow">{campaign.type}</span>
        <h1>{campaign.name}</h1>
        <p>{campaign.description}</p>
      </header>

      <section className="campaign-stats">
        <div className="surface surface-pad-sm"><b>{campaign.profileCount}</b><span>Project Passports</span></div>
        <div className="surface surface-pad-sm"><b>{campaign.storedProofs}</b><span>Stored proofs</span></div>
        <div className="surface surface-pad-sm"><b>{campaign.checkpoints.length}</b><span>Checkpoints</span></div>
      </section>

      <section className="surface surface-pad" style={{ marginTop: 24 }}>
        <h2 className="section-title">Plug in</h2>
        <div className="integration-rows">
          <IntegrationRow label="Hosted link" value={links.hosted} />
          <IntegrationRow label="Embed" value={links.embed} />
          <IntegrationRow label="API feed" value={links.api} />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <div className="rows-head">
          <div>Project</div><div>Builder</div><div className="col-round">Checkpoint</div><div>Signal</div><div>Proof</div>
        </div>
        {profiles.length === 0 ? (
          <div className="empty">No Project Passports yet. Share the hosted link to start collecting proof.</div>
        ) : (
          profiles.map((profile) => <ProjectRow capsule={profile} key={profile.id} />)
        )}
      </section>
    </main>
  );
}

function IntegrationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="record-row">
      <span>{label}</span>
      <code>{value}</code>
      <button className="icon-btn" type="button" onClick={() => navigator.clipboard.writeText(value)} title="Copy">
        <Copy size={13} />
      </button>
    </div>
  );
}
