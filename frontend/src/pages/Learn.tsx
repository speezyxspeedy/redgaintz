import { BookOpen, Brain, HelpCircle, Lightbulb } from "lucide-react";
import { GLOSSARY } from "../theme";
import { getCopy, type Language } from "../i18n";

export default function Learn({ language = "en" }: { language?: Language }) {
  const copy = getCopy(language);
  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow"><BookOpen size={14} aria-hidden="true" /> {copy.learn.eyebrow}</span>
        <h1>{copy.learn.title}</h1>
        <p className="lede">{copy.learn.intro} {language === "en" && "Open the glossary below when a word feels new."}</p>
      </header>
      <aside className="learn-helper card" aria-labelledby="learn-helper-title">
        <span className="learn-helper-icon"><Brain size={20} aria-hidden="true" /></span>
        <div>
          <h2 id="learn-helper-title">{copy.assistant.title}</h2>
          <p>{copy.assistant.noResult}</p>
          <ul><li>{copy.assistant.choose}</li><li>{copy.assistant.key}</li></ul>
        </div>
      </aside>

      <section className="band" aria-labelledby="read">
        <h2 id="read">{copy.learn.readTitle}</h2>
        <div className="read-grid">
          {copy.learn.cards.map((card) => <div className="read-card" key={card.title}><Lightbulb size={20} aria-hidden="true" /><h3>{card.title}</h3><p>{card.text}</p></div>)}
        </div>
      </section>

      <section className="band" aria-labelledby="gloss">
        <h2 id="gloss">{copy.learn.glossary}</h2>
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
