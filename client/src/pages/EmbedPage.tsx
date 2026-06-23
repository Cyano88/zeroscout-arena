import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { CampaignPreset } from "../../../shared/types";
import { api } from "../api";
import { ArenaPage } from "./ArenaPage";

export function EmbedPage() {
  const { campaignId = "custom" } = useParams();
  const [campaign, setCampaign] = useState<CampaignPreset | null>(null);

  useEffect(() => {
    void api.campaign(campaignId).then(setCampaign).catch(() => setCampaign(null));
  }, [campaignId]);

  return (
    <main className="embed-shell">
      <header className="embed-head">
        <span>ZeroScout Widget</span>
        <b>{campaign?.name ?? "Builder Program"}</b>
      </header>
      <ArenaPage forcedCampaignId={campaignId} compact />
    </main>
  );
}
