import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { CampaignPreset } from "../../../shared/types";
import { api } from "../api";
import { ArenaPage } from "./ArenaPage";
import { MatchupPage } from "./MatchupPage";
import { DocsPage } from "./DocsPage";

type EmbedTab = "create" | "compare" | "verify";

export function EmbedPage() {
  const { campaignId = "custom" } = useParams();
  const [campaign, setCampaign] = useState<CampaignPreset | null>(null);
  const [tab, setTab] = useState<EmbedTab>("create");

  useEffect(() => {
    void api.campaign(campaignId).then(setCampaign).catch(() => setCampaign(null));
  }, [campaignId]);

  return (
    <main className="embed-shell">
      <header className="embed-head">
        <div>
          <span>Builder proof workspace</span>
          <b>{campaign?.name ?? "Builder Program"}</b>
        </div>
        <nav className="embed-tabs" aria-label="Builder proof actions">
          <button className={tab === "create" ? "active" : ""} type="button" onClick={() => setTab("create")}>Create</button>
          <button className={tab === "compare" ? "active" : ""} type="button" onClick={() => setTab("compare")}>Compare</button>
          <button className={tab === "verify" ? "active" : ""} type="button" onClick={() => setTab("verify")}>Verify</button>
        </nav>
      </header>
      {tab === "create" && <ArenaPage forcedCampaignId={campaignId} compact />}
      {tab === "compare" && <MatchupPage campaignId={campaignId} compact />}
      {tab === "verify" && <DocsPage compact programName={campaign?.name ?? "this program"} />}
      <footer className="embed-footer">
        <div>
          <span>Powered by</span>
          <strong>ZeroScout</strong>
        </div>
        <nav aria-label="Program actions">
          <button type="button" onClick={() => setTab("verify")}>Verify</button>
          <button type="button" onClick={() => setTab("compare")}>Compare</button>
          <button type="button" onClick={() => setTab("create")}>Create</button>
        </nav>
      </footer>
    </main>
  );
}
