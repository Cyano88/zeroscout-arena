import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { ArenaPage } from "./pages/ArenaPage";
import { CapsulePage } from "./pages/CapsulePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { MatchupPage } from "./pages/MatchupPage";
import { DocsPage } from "./pages/DocsPage";
import "./styles.css";

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("zeroscout-theme") ?? "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("zeroscout-theme", theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="zg-mark">0G</span>
            <span>ZeroScout</span>
          </NavLink>
          <nav>
            <NavLink to="/">Create</NavLink>
            <NavLink to="/leaderboard">Projects</NavLink>
            <NavLink to="/matchup">Compare</NavLink>
            <NavLink to="/docs">Verify</NavLink>
          </nav>
          <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button" title="Toggle theme">
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </header>
        <Routes>
          <Route path="/" element={<ArenaPage />} />
          <Route path="/capsules/:id" element={<CapsulePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/matchup" element={<MatchupPage />} />
          <Route path="/docs" element={<DocsPage />} />
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
