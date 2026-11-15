import { BookOpen, HelpCircle, Lightbulb } from "lucide-react";
import { GLOSSARY } from "../theme";

export default function Learn() {
  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow"><BookOpen size={14} aria-hidden="true" /> Learn</span>
        <h1>The detective's handbook</h1>
        <p className="lede">Ten ideas that turn a wiggly line into a trustworthy answer. Hover or tap any underlined word inside the app to see these definitions in place.</p>
      </header>

      <section className="band" aria-labelledby="read">
        <h2 id="read">How to read a result</h2>
        <div className="read-grid">
          <div className="read-card"><Lightbulb size={20} aria-hidden="true" /><h3>1. Look at the line</h3><p>Points are yearly values. The white line is the typical change (Sen's slope). The shaded band is the 95% confidence range.</p></div>
          <div className="read-card"><Lightbulb size={20} aria-hidden="true" /><h3>2. Read the verdict</h3><p>“Significant” means the pattern is too steady to be luck. “Not significant” means the data cannot tell a trend from normal ups and downs.</p></div>
          <div className="read-card"><Lightbulb size={20} aria-hidden="true" /><h3>3. Ask how big</h3><p>A tiny change can be significant, and a big change can fail the test if years swing wildly. Compare the total change with the average.</p></div>
          <div className="read-card"><Lightbulb size={20} aria-hidden="true" /><h3>4. Check the warnings</h3><p>Short records, correlated years and disagreement between methods all make a result less certain.</p></div>
        </div>
      </section>

      <section className="band" aria-labelledby="gloss">
        <h2 id="gloss">Glossary</h2>
        <dl className="gloss">
          {GLOSSARY.map((g) => (
            <div key={g.id} className="gloss-item">
              <dt><HelpCircle size={15} aria-hidden="true" /> {g.term}</dt>
              <dd><strong>{g.short}</strong> {g.long}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
