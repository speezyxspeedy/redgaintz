import { BookOpen, Compass, Database, Globe2, Map as MapIcon, Home as HomeIcon, Presentation } from "lucide-react";
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
import { getCopy, LANGUAGES, type Language } from "./i18n";

const Explore = lazy(() => import("./pages/Explore"));
const ChatBot = lazy(() => import("./ChatBot"));
const Present = lazy(() => import("./present/Present"));

const NAV = [
  { path: "/", label: "Home", Icon: HomeIcon },
  { path: "/explore", label: "Globe", Icon: Globe2 },
  { path: "/atlas", label: "Atlas", Icon: MapIcon },
  { path: "/investigate", label: "Investigate", Icon: Compass },
  { path: "/learn", label: "Learn", Icon: BookOpen },
  { path: "/about", label: "Data & method", Icon: Database },
  { path: "/present", label: "Present", Icon: Presentation },
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
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("terrascan-language") as Language) || "en");
  const copy = getCopy(language);
  const onResult = useCallback((r: AnalysisResult | null) => setChatResult(r), []);
  const path = NAV.some((n) => n.path === route.path) ? route.path : "/";

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = `${copy.nav[NAV.find((n) => n.path === path)?.label === "Data & method" ? "dataMethod" : (NAV.find((n) => n.path === path)?.label.toLowerCase() as keyof typeof copy.nav) ?? "home"] ?? "Home"} · TERRASCAN`;
  }, [copy.nav, path]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    localStorage.setItem("terrascan-language", next);
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="TERRASCAN home">
          <Logo />
          <span>TERRA<b>SCAN</b></span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map(({ path: p, label, Icon }) => {
            const navLabel = label === "Data & method" ? copy.nav.dataMethod : copy.nav[label.toLowerCase() as keyof typeof copy.nav] ?? label;
            return (
            <a key={p} href={`#${p}`} aria-current={path === p ? "page" : undefined} className={path === p ? "is-on" : ""}>
              <Icon size={16} aria-hidden="true" /> {navLabel}
            </a>
            );
          })}
        </nav>
        <label className="language-picker"><span>{copy.language}</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Language)} aria-label={copy.language}>{LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </header>

      <main id="main">
        {path === "/" && <Home language={language} />}
        {path === "/atlas" && <Atlas language={language} />}
        {path === "/explore" && <Suspense fallback={null}><Explore language={language} /></Suspense>}
        {path === "/investigate" && <Investigate language={language} params={route.params} onResult={onResult} />}
        {path === "/learn" && <Learn language={language} />}
        {path === "/about" && <About language={language} />}
        {path === "/present" && <Suspense fallback={<div className="present-loading" role="status">Loading presentation…</div>}><Present result={chatResult} /></Suspense>}
      </main>

      {path !== "/present" && <nav className="tabbar" aria-label="Main (mobile)">
        {NAV.map(({ path: p, label, Icon }) => (
          <a key={p} href={`#${p}`} aria-current={path === p ? "page" : undefined} className={path === p ? "is-on" : ""}>
            <Icon size={20} aria-hidden="true" />
            <span>{label === "Data & method" ? copy.nav.data : copy.nav[label.toLowerCase() as keyof typeof copy.nav] ?? label}</span>
          </a>
        ))}
      </nav>}

      {path !== "/present" && <footer className="footer">
        <span>{copy.footerData}</span>
        <span>{copy.footerNote}</span>
        <a href="#/about">{copy.footerLink}</a>
      </footer>}

      {path !== "/present" && <Suspense fallback={null}>
        <ChatBot language={language} result={chatResult} selectedRegionId={chatResult?.region_id?.startsWith("IN-MH-VID") ? chatResult.region_id : "IN-MH-VID"} preset="vidarbha" registries={null} />
      </Suspense>}
    </>
  );
}
