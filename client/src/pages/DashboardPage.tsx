import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, Wallet, Zap } from "lucide-react";
import { api } from "../api";
import type { IntegrationKeyRecord } from "../../../shared/types";

type PublicKey = Omit<IntegrationKeyRecord, "keyHash">;

const API_ORIGIN = window.location.origin;

export function DashboardPage() {
  const [wallet, setWallet] = useState("");
  const [keys, setKeys] = useState<PublicKey[]>([]);
  const [pricing, setPricing] = useState<{ costs: { capsule: number; videoScore: number }; creditsPerOg: number; treasuryAddress?: string; chainId: number; network: string } | null>(null);
  const [keyName, setKeyName] = useState("production");
  const [partner, setPartner] = useState("My platform");
  const [newKey, setNewKey] = useState("");
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState("");

  const totalCredits = useMemo(() => keys.reduce((sum, key) => sum + (key.creditBalance ?? 0), 0), [keys]);
  const totalUsed = useMemo(() => keys.reduce((sum, key) => sum + (key.creditsUsed ?? 0), 0), [keys]);

  useEffect(() => {
    api.integrationPricing().then(setPricing).catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!wallet) return;
    refreshKeys(wallet);
  }, [wallet]);

  async function refreshKeys(nextWallet = wallet) {
    if (!nextWallet) return;
    setKeys(await api.dashboardKeys(nextWallet));
  }

  async function connectWallet() {
    setStatus("");
    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<string[]> } }).ethereum;
    if (!ethereum) {
      setStatus("Install or open a browser wallet to create API keys.");
      return;
    }
    setLoading("wallet");
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0] ?? "");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setLoading("");
    }
  }

  async function createKey() {
    if (!wallet) return connectWallet();
    setStatus("");
    setLoading("key");
    try {
      const created = await api.createDashboardKey({ wallet, name: keyName, partner });
      setNewKey(created.key);
      await refreshKeys(wallet);
      setStatus("Key created. Store it now; ZeroScout will not show the full key again.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create key.");
    } finally {
      setLoading("");
    }
  }

  async function verifyTopUp() {
    if (!wallet) return connectWallet();
    setStatus("");
    setLoading("topup");
    try {
      const result = await api.verifyTopUp({ wallet, txHash });
      setKeys(result.keys);
      setTxHash("");
      setStatus(`Top-up confirmed: ${result.amountOg} OG added ${result.credits} credits.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not verify top-up.");
    } finally {
      setLoading("");
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setStatus("Copied.");
  }

  return (
    <main className="page dashboard-page">
      <header className="page-heading compact-heading">
        <span className="eyebrow">API Dashboard</span>
        <h1>Fund a key, call 0G through ZeroScout</h1>
        <p>Create capped API keys for platforms that want Project Passports, 0G video scoring, and proof records without rebuilding the 0G integration layer.</p>
      </header>

      <section className="dashboard-hero surface">
        <div>
          <span className="status-tag"><Zap size={12} /> Credit gateway</span>
          <h2>{wallet ? short(wallet) : "Connect wallet"}</h2>
          <p>Keys are tied to your wallet. Credits cap usage so external apps cannot run unlimited 0G Compute or Storage calls.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={connectWallet} disabled={loading === "wallet"}>
          {loading === "wallet" ? <Loader2 size={14} className="spin" /> : <Wallet size={14} />}
          {wallet ? "Wallet connected" : "Connect wallet"}
        </button>
      </section>

      <section className="dashboard-stats">
        <Metric label="Available credits" value={String(totalCredits)} />
        <Metric label="Credits used" value={String(totalUsed)} />
        <Metric label="Passport API" value={`${pricing?.costs.capsule ?? 5} cr`} />
        <Metric label="Video review" value={`${pricing?.costs.videoScore ?? 20} cr`} />
      </section>

      <section className="dashboard-grid">
        <div className="surface dashboard-panel">
          <div className="panel-head">
            <span className="eyebrow">Create key</span>
            <KeyRound size={16} />
          </div>
          <label>
            Key name
            <input value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="production" />
          </label>
          <label>
            Platform
            <input value={partner} onChange={(event) => setPartner(event.target.value)} placeholder="Grail, university, hackathon..." />
          </label>
          <button className="btn btn-primary" type="button" onClick={createKey} disabled={loading === "key"}>
            {loading === "key" ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
            Create API key
          </button>

          {newKey && (
            <div className="secret-box">
              <span>Shown once</span>
              <code>{newKey}</code>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => copy(newKey)}>Copy key</button>
            </div>
          )}
        </div>

        <div className="surface dashboard-panel">
          <div className="panel-head">
            <span className="eyebrow">Top up</span>
            <Wallet size={16} />
          </div>
          <p className="muted-copy">Send OG on 0G Chain to the treasury, then paste the transaction hash. Credits are added after on-chain confirmation.</p>
          <div className="treasury-box">
            <span>Treasury</span>
            <code>{pricing?.treasuryAddress ?? "Not configured"}</code>
            {pricing?.treasuryAddress && <button type="button" className="icon-btn" onClick={() => copy(pricing.treasuryAddress!)}><Copy size={13} /></button>}
          </div>
          <p className="muted-copy">{pricing ? `Rate: ${pricing.creditsPerOg} credits per OG on chain ${pricing.chainId}.` : "Loading rate..."}</p>
          <label>
            Transaction hash
            <input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." />
          </label>
          <button className="btn btn-primary" type="button" onClick={verifyTopUp} disabled={loading === "topup" || !txHash.trim()}>
            {loading === "topup" ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
            Verify top-up
          </button>
        </div>
      </section>

      <section className="surface key-table">
        <div className="panel-head">
          <span className="eyebrow">Keys</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => refreshKeys()}>Refresh</button>
        </div>
        {keys.length === 0 ? (
          <p className="muted-copy">No keys yet. Create a key, fund it with credits, then use it from your backend.</p>
        ) : (
          keys.map((key) => (
            <div className="key-row" key={key.id}>
              <div>
                <strong>{key.name}</strong>
                <span>{key.partner ?? "External platform"} - {key.keyPreview}</span>
              </div>
              <div>
                <b>{key.creditBalance ?? 0}</b>
                <span>credits left</span>
              </div>
              <div>
                <b>{key.requestCount ?? 0}</b>
                <span>requests</span>
              </div>
              <span className={key.revokedAt ? "pill danger" : "pill"}>{key.revokedAt ? "Revoked" : "Active"}</span>
            </div>
          ))
        )}
      </section>

      <section className="surface env-box">
        <span className="eyebrow">Backend env</span>
        <pre>{`ZEROSCOUT_API_URL=${API_ORIGIN}
ZEROSCOUT_INTEGRATION_SECRET=zs_live_key_from_this_dashboard`}</pre>
      </section>

      {status && <div className="toast-line">{status}</div>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function short(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
