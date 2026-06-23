import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { ArenaPage } from "./pages/ArenaPage";
import { CapsulePage } from "./pages/CapsulePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { MatchupPage } from "./pages/MatchupPage";
import { DocsPage } from "./pages/DocsPage";
import { CampaignDetailPage, CampaignsPage } from "./pages/CampaignsPage";
import { EmbedPage } from "./pages/EmbedPage";
import ogLogo from "./assets/og-logo.jpeg";
import zeroScoutMark from "./assets/zeroscout-mark.png";
import grailMark from "./assets/grail-mark.png";
import "./styles.css";

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("zeroscout-theme") ?? "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("zeroscout-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-img", `url("${ogLogo}")`);
    document.documentElement.style.setProperty("--zeroscout-mark", `url("${zeroScoutMark}")`);
    document.documentElement.style.setProperty("--grail-mark", `url("${grailMark}")`);
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span>ZeroScout</span>
          </NavLink>
          <nav className="top-nav">
            <NavLink to="/campaigns">Campaigns</NavLink>
            <NavLink to="/projects">Projects</NavLink>
            <NavLink to="/compare">Compare</NavLink>
            <NavLink to="/" end>Create</NavLink>
            <NavLink to="/verify">Verify</NavLink>
          </nav>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            type="button"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </header>
        <Routes>
          <Route path="/" element={<ArenaPage />} />
          <Route path="/projects/:id" element={<CapsulePage />} />
          <Route path="/projects" element={<LeaderboardPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/compare" element={<MatchupPage />} />
          <Route path="/verify" element={<DocsPage />} />
          <Route path="/embed/:campaignId" element={<EmbedPage />} />
          <Route path="/capsules/:id" element={<CapsulePage />} />
          <Route path="/leaderboard" element={<Navigate to="/projects" replace />} />
          <Route path="/matchup" element={<Navigate to="/compare" replace />} />
          <Route path="/docs" element={<Navigate to="/verify" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
