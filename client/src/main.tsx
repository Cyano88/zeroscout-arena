import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ExternalLink, Menu, Moon, Sun, X } from "lucide-react";
import { ArenaPage } from "./pages/ArenaPage";
import { CapsulePage } from "./pages/CapsulePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { MatchupPage } from "./pages/MatchupPage";
import { DocsPage } from "./pages/DocsPage";
import { DocumentationPage } from "./pages/DocumentationPage";
import { EmbedPage } from "./pages/EmbedPage";
import { IntegratePage } from "./pages/IntegratePage";
import ogLogo from "./assets/og-logo.jpeg";
import zeroScoutMark from "./assets/zeroscout-mark.png";
import grailMark from "./assets/grail-mark.png";
import "./styles.css";

const DashboardRoute = React.lazy(() => import("./pages/DashboardRoute"));

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("zeroscout-theme") ?? "dark");
  const isEmbed = window.location.pathname.startsWith("/embed/");

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
        {!isEmbed && <Topbar theme={theme} setTheme={setTheme} />}
        <Routes>
          <Route path="/" element={<ArenaPage />} />
          <Route path="/projects/:id" element={<CapsulePage />} />
          <Route path="/projects" element={<LeaderboardPage />} />
          <Route path="/compare" element={<MatchupPage />} />
          <Route path="/integrate" element={<IntegratePage />} />
          <Route path="/dashboard" element={
            <React.Suspense fallback={<main className="page"><div className="surface">Loading API dashboard...</div></main>}>
              <DashboardRoute />
            </React.Suspense>
          } />
          <Route path="/verify" element={<DocsPage />} />
          <Route path="/docs" element={<DocumentationPage />} />
          <Route path="/zeroscout/docs" element={<DocumentationPage />} />
          <Route path="/embed/:campaignId" element={<EmbedPage />} />
          <Route path="/capsules/:id" element={<CapsulePage />} />
          <Route path="/campaigns" element={<Navigate to="/projects" replace />} />
          <Route path="/campaigns/:id" element={<Navigate to="/projects" replace />} />
          <Route path="/leaderboard" element={<Navigate to="/projects" replace />} />
          <Route path="/matchup" element={<Navigate to="/compare" replace />} />
        </Routes>
        {!isEmbed && <SiteFooter />}
      </div>
    </BrowserRouter>
  );
}

const navItems = [
  { to: "/projects", label: "Projects" },
  { to: "/", label: "Create", end: true },
  { to: "/compare", label: "Compare" },
  { to: "/integrate", label: "Integrate" },
  { to: "/dashboard", label: "API" },
  { to: "/verify", label: "Verify" }
];

function Topbar({ theme, setTheme }: { theme: string; setTheme: React.Dispatch<React.SetStateAction<string>> }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="topbar">
      <NavLink to="/" className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>ZeroScout</span>
      </NavLink>

      <nav className="top-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="top-actions">
        <a className="top-link" href="https://x.com/ZeroScoutApp" target="_blank" rel="noreferrer">
          X <ExternalLink size={12} />
        </a>
        <NavLink className="top-link" to="/docs">Docs</NavLink>
        <div className="nav-menu-wrap">
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
          {open && (
            <nav className="nav-menu" aria-label="Primary navigation">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          type="button"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Powered by</span>
      <strong>0G Labs</strong>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
