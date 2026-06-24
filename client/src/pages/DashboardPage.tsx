import { useEffect, useMemo, useState } from "react";
import { parseEther, toBeHex } from "ethers";
import { CheckCircle2, Copy, KeyRound, Loader2, Wallet, Zap } from "lucide-react";
import { api } from "../api";
import type { IntegrationKeyRecord } from "../../../shared/types";

type PublicKey = Omit<IntegrationKeyRecord, "keyHash">;

const API_ORIGIN = window.location.origin;

export function DashboardPage() {
  const [wallet, setWallet] = useState("");
  const [keys, setKeys] = useState<PublicKey[]>([]);
  const [balance, setBalance] = useState({ creditedOg: "0", creditsPurchased: 0, topUpCount: 0 });
  const [pricing, setPricing] = useState<{ costs: { capsule: number; videoScore: number }; creditsPerOg: number; treasuryAddress?: string; chainId: number; network: string } | null>(null);
  const [keyName, setKeyName] = useState("production");
  const [partner, setPartner] = useState("My platform");
  const [newKey, setNewKey] = useState("");
  const [amountOg, setAmountOg] = useState("1");
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
    const result = await api.dashboardKeys(nextWallet);
    setKeys(result.keys);
    setBalance(result.balance);
    setStatus("Credits refreshed.");
  }

  async function connectWallet() {
    setStatus("");
    const ethereum = walletProvider();
    if (!ethereum) {
      setStatus("Install or open a browser wallet to create API keys.");
      return;
    }
    setLoading("wallet");
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      setWallet(Array.isArray(accounts) ? String(accounts[0] ?? "") : "");
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
      const result = await pollTopUpVerification(wallet, txHash, (message) => setStatus(message));
      setKeys(result.keys);
      setBalance({ creditedOg: addDecimal(balance.creditedOg, result.amountOg), creditsPurchased: balance.creditsPurchased + result.credits, topUpCount: balance.topUpCount + 1 });
      setTxHash("");
      setStatus(`Top-up confirmed: ${result.amountOg} OG added ${result.credits} credits.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not verify top-up.");
    } finally {
      setLoading("");
    }
  }

  async function fundCredits() {
    if (!wallet) return connectWallet();
    if (!pricing?.treasuryAddress) {
      setStatus("Top-ups are not live yet. ZeroScout treasury is not configured.");
      return;
    }
    const ethereum = walletProvider();
    if (!ethereum) {
      setStatus("Open this page in a browser wallet to fund credits.");
      return;
    }

    setStatus("");
    setLoading("fund");
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toBeHex(pricing.chainId) }]
      }).catch(() => undefined);

      const hash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet,
          to: pricing.treasuryAddress,
          value: toBeHex(parseEther(amountOg || "0"))
        }]
      });
      setTxHash(String(hash));
      setStatus("Transaction sent. Waiting for 0G Chain confirmation...");
      const result = await pollTopUpVerification(wallet, String(hash), (message) => setStatus(message));
      setKeys(result.keys);
      setBalance({ creditedOg: addDecimal(balance.creditedOg, result.amountOg), creditsPurchased: balance.creditsPurchased + result.credits, topUpCount: balance.topUpCount + 1 });
      setTxHash("");
      setStatus(`Credits funded: ${result.amountOg} OG added ${result.credits} credits.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Credit funding failed.");
    } finally {
      setLoading("");
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setStatus("Copied.");
  }

  async function refreshCredits() {
    if (!wallet) return connectWallet();
    setLoading("refresh");
    try {
      await refreshKeys(wallet);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh credits.");
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="page dashboard-page">
      <header className="page-heading compact-heading">
        <span className="eyebrow">API Dashboard</span>
        <h1>Fund a key, call 0G through ZeroScout</h1>
        <p>Create a capped server key for Project Passports and video scoring. ZeroScout handles the 0G Storage and 0G Compute calls behind your platform.</p>
      </header>

      <section className="dashboard-hero surface">
        <div>
          <span className="status-tag"><Zap size={12} /> Credit gateway</span>
          <h2>{wallet ? short(wallet) : "Connect wallet"}</h2>
          <p>Your wallet owns the keys. Credits limit usage, so a platform can call ZeroScout without exposing your account or running unlimited 0G work.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={connectWallet} disabled={loading === "wallet"}>
          {loading === "wallet" ? <Loader2 size={14} className="spin" /> : <Wallet size={14} />}
          {wallet ? "Wallet connected" : "Connect wallet"}
        </button>
      </section>

      <section className="dashboard-stats">
        <Metric label="Available credits" value={String(totalCredits)} />
        <Metric label="Credits used" value={String(totalUsed)} />
        <Metric label="Credited OG" value={balance.creditedOg} />
        <Metric label="Top-ups" value={String(balance.topUpCount)} />
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
          <p className="muted-copy">Choose an amount, approve the OG transfer in your wallet, and ZeroScout verifies the transaction before adding credits.</p>
          <div className="treasury-box">
            <span>Treasury</span>
            <code>{pricing?.treasuryAddress ?? "Not configured"}</code>
            {pricing?.treasuryAddress && <button type="button" className="icon-btn" onClick={() => copy(pricing.treasuryAddress!)}><Copy size={13} /></button>}
          </div>
          <p className="muted-copy">{pricing ? `Rate: ${pricing.creditsPerOg} credits per OG on chain ${pricing.chainId}.` : "Loading rate..."}</p>
          <label>
            Amount
            <input value={amountOg} onChange={(event) => setAmountOg(event.target.value)} placeholder="1" inputMode="decimal" />
          </label>
          <button className="btn btn-primary" type="button" onClick={fundCredits} disabled={loading === "fund" || !pricing?.treasuryAddress || Number(amountOg) <= 0}>
            {loading === "fund" ? <Loader2 size={14} className="spin" /> : <Wallet size={14} />}
            Fund credits
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={refreshCredits} disabled={loading === "refresh"}>
            {loading === "refresh" ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
            Refresh credits
          </button>
          <details className="recovery-box">
            <summary>Recover a sent transfer</summary>
            <p className="muted-copy">Use this only if the wallet closed or the page refreshed after payment.</p>
            <label>
              Transaction hash
              <input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." />
            </label>
            <button className="btn btn-ghost btn-sm" type="button" onClick={verifyTopUp} disabled={loading === "topup" || !txHash.trim()}>
              {loading === "topup" ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
              Verify transaction
            </button>
          </details>
        </div>
      </section>

      <section className="surface key-table">
        <div className="panel-head">
          <span className="eyebrow">Keys</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={refreshCredits}>Refresh credits</button>
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
        <span className="eyebrow">Use the key</span>
        <div className="integration-guide">
          <div>
            <h2>1. Put this on your backend</h2>
            <pre>{`ZEROSCOUT_API_URL=${API_ORIGIN}
ZEROSCOUT_INTEGRATION_SECRET=zs_live_key_from_this_dashboard`}</pre>
          </div>
          <div>
            <h2>2. Send the key only from your server</h2>
            <p>Never place the key in browser JavaScript, public env vars, or an iframe URL. Your backend sends it as a bearer token.</p>
            <pre>{`Authorization: Bearer $ZEROSCOUT_INTEGRATION_SECRET`}</pre>
          </div>
          <div>
            <h2>3. Pick the endpoint you need</h2>
            <p><b>Video scoring</b> is for platforms like Grail that already have their own user flow and want ZeroScout to store/review an uploaded video.</p>
            <pre>{`POST /api/integrations/video-score
multipart: video, platform, program, projectName, prompt
cost: ${pricing?.costs.videoScore ?? 20} credits`}</pre>
            <p><b>Passport creation</b> is for platforms that already collect builder data and want ZeroScout to create a 0G-backed Project Passport.</p>
            <pre>{`POST /api/integrations/capsules
json: projectName, teamName, repoUrl, demoUrl, description, ogUsageClaims...
cost: ${pricing?.costs.capsule ?? 5} credits`}</pre>
          </div>
        </div>
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

function addDecimal(left: string, right: string) {
  const value = Number(left || "0") + Number(right || "0");
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function walletProvider() {
  return (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
}

async function pollTopUpVerification(wallet: string, txHash: string, onStatus: (message: string) => void) {
  let lastError = "";
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    try {
      return await api.verifyTopUp({ wallet, txHash });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Could not verify top-up.";
      if (!lastError.toLowerCase().includes("not confirmed")) throw error;
      onStatus(`Transaction submitted. Waiting for confirmation... ${attempt}/18`);
      await delay(5000);
    }
  }
  throw new Error(`${lastError} Try again from "Already sent OG?" in a minute.`);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
