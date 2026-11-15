import { Activity, Cloud, Droplets, Flame, MoonStar, Sun, Thermometer, Wind, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { accentFor, glossaryById } from "./theme";

const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets,
  thermo: Thermometer,
  flame: Flame,
  moon: MoonStar,
  cloud: Cloud,
  wind: Wind,
  sun: Sun,
  activity: Activity,
};

export function VarIcon({ id, size = 20 }: { id: string; size?: number }) {
  const Cmp = ICONS[accentFor(id).icon] ?? Activity;
  return <Cmp size={size} aria-hidden="true" />;
}

/** Inline glossary term: hover, focus or tap shows a one-sentence plain-language definition. */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const entry = glossaryById(id);
  if (!entry) return <>{children}</>;
  return (
    <span className="term" tabIndex={0} role="button" aria-describedby={`tip-${id}`}>
      {children ?? entry.term}
      <span className="term-tip" role="tooltip" id={`tip-${id}`}>
        <strong>{entry.term}</strong>
        {entry.short}
      </span>
    </span>
  );
}

/** Hash router: #/path?key=value */
export interface Route {
  path: string;
  params: URLSearchParams;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(path: string, params?: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
  const s = q.toString();
  window.location.hash = `${path}${s ? `?${s}` : ""}`;
}

/** Update the hash without adding history entries or re-triggering the router. */
export function replaceParams(path: string, params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
  history.replaceState(null, "", `#${path}?${q.toString()}`);
}
