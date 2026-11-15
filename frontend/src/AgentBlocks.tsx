import { AdvChart } from "./AdvancedCharts";
import { go } from "./components";
import type { Block } from "./agent";

const TITLES: Record<string, string> = { probability: "Share of years at or below each value", change: "Yearly values and 10-year mean", compare: "Spread of yearly values", forecast: "Straight-line extension, 95% range" };

export default function AgentBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="agent-blocks">
      {blocks.map((b, i) => {
        if (b.type === "entities") return <p key={i} className="agent-ent">{b.items.map(([k, v]) => <span key={k}><b>{k}</b> {v}</span>)}</p>;
        if (b.type === "table") return <table key={i} className="agent-table"><tbody>{b.rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>;
        if (b.type === "chart") return <figure key={i} className="agent-chart"><figcaption>{TITLES[b.title]}</figcaption><AdvChart adv={b.adv} kind={b.kind} h={190} /></figure>;
        return <div key={i} className="agent-actions">{b.items.map((a) => <button key={a.label} className="btn" onClick={() => go(a.path, a.params && Object.fromEntries(Object.entries(a.params).filter(([, v]) => v)))}>{a.label}</button>)}</div>;
      })}
    </div>
  );
}
