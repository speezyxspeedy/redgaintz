import { BookOpen, Compass, Database, Globe2, Map as MapIcon, Home as HomeIcon } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import "./chatbot.css";
import "./redesign.css";
import { useRoute } from "./components";
import About from "./pages/About";
import Atlas from "./pages/Atlas";
import Home from "./pages/Home";
import Investigate from "./pages/Investigate";
import Learn from "./pages/Learn";
import type { AnalysisResult } from "./types";

const Explore = lazy(() => import("./pages/Explore"));
const ChatBot = lazy(() => import("./ChatBot"));

const NAV = [
  { path: "/", label: "Home", Icon: HomeIcon },
  { path: "/explore", label: "Globe", Icon: Globe2 },
  { path: "/atlas", label: "Atlas", Icon: MapIcon },
  { path: "/investigate", label: "Investigate", Icon: Compass },
  { path: "/learn", label: "Learn", Icon: BookOpen },
  { path: "/about", label: "Data & method", Icon: Database },
] as const;

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="9" fill="url(#lg)" />
      <ellipse cx="20" cy="20" rx="18" ry="7" fill="none" stroke="url(#lg)" strokeWidth="2" transform="rotate(-24 20 20)" />
      <circle cx="33.5" cy="12.5" r="2.4" fill="#fbbf24" />
    </svg>
  );
}

export default function App() {
  const route = useRoute();
  const [chatResult, setChatResult] = useState<AnalysisResult | null>(null);
  const onResult = useCallback((r: AnalysisResult | null) => setChatResult(r), []);
  const path = NAV.some((n) => n.path === route.path) ? route.path : "/";

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = `${NAV.find((n) => n.path === path)?.label ?? "Home"} · TERRASCAN`;
  }, [path]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="TERRASCAN home">
          <Logo />
          <span>TERRA<b>SCAN</b></span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map(({ path: p, label, Icon }) => (
            <a key={p} href={`#${p}`} aria-current={path === p ? "page" : undefined} className={path === p ? "is-on" : ""}>
              <Icon size={16} aria-hidden="true" /> {label}
            </a>
          ))}
        </nav>
      </header>

      <main id="main">
        {path === "/" && <Home />}
        {path === "/atlas" && <Atlas />}
        {path === "/explore" && <Suspense fallback={null}><Explore /></Suspense>}
        {path === "/investigate" && <Investigate params={route.params} onResult={onResult} />}
        {path === "/learn" && <Learn />}
        {path === "/about" && <About />}
      </main>

      <nav className="tabbar" aria-label="Main (mobile)">
        {NAV.map(({ path: p, label, Icon }) => (
          <a key={p} href={`#${p}`} aria-current={path === p ? "page" : undefined} className={path === p ? "is-on" : ""}>
            <Icon size={20} aria-hidden="true" />
            <span>{label === "Data & method" ? "Data" : label}</span>
          </a>
        ))}
      </nav>

      <footer className="footer">
        <span>Data: NASA POWER (MERRA-2) and NASA GIBS. Not endorsed by NASA.</span>
        <span>NASA Space Apps Challenge 2026, Nagpur. Results describe trends, not causes.</span>
        <a href="#/about">Data, method and privacy</a>
      </footer>

      <Suspense fallback={null}>
      <ChatBot result={chatResult} selectedRegionId={chatResult?.region_id?.startsWith("IN-MH-VID") ? chatResult.region_id : "IN-MH-VID"} preset="vidarbha" registries={null} />
      </Suspense>
    </>
  );
}
