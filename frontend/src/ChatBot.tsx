import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Check, Key, Send, Sparkles, X } from "lucide-react";
import type { AnalysisResult, Registries } from "./types";
import { getActiveKey, getRAGError, initRAG, queryRAG, saveActiveKey, type RAGContext, type RAGStatus } from "./ragService";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isLLM?: boolean;
}

interface AssistantProps {
  result: AnalysisResult | null;
  selectedRegionId: string;
  preset: "india" | "maharashtra" | "vidarbha";
  registries: Registries | null;
}

function resultSummary(result: AnalysisResult | null): string {
  if (!result) return "No analysis has been run yet. Run an analysis first; I will only explain its computed result JSON.";
  if (!result.trend) return "No analysis has been run yet. The current result has no computed trend.";
  const trend = result.trend;
  const values = [
    `${result.variable} (${result.units})`,
    `direction: ${trend.direction ?? "not reported"}`,
    `p-value: ${trend.p_value ?? "not reported"}`,
    `years used: ${trend.sample_count ?? "not reported"}`,
  ];
  return `Computed result: ${values.join("; ")}. Trend is statistical only, not causation.`;
}

export default function ChatBot({ result, selectedRegionId, preset, registries: _registries }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RAGStatus>("idle");
  const [keyModal, setKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState(getActiveKey());
  const [mode, setMode] = useState<"simple" | "expert">("simple");
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: resultSummary(result), timestamp: new Date() },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initRAG().then(setStatus);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const connect = async () => {
    saveActiveKey(keyInput);
    const next = await initRAG(keyInput);
    setStatus(next);
    if (next === "ready") setKeyModal(false);
  };

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || typing) return;
    setMessages((old) => [...old, { id: `u-${Date.now()}`, role: "user", text: question, timestamp: new Date() }]);
    setInput("");
    setTyping(true);
    const context: RAGContext = {
      selectedRegion: selectedRegionId,
      regionName: selectedRegionId,
      preset,
      mode,
      result,
      conversationHistory: [],
    };
    try {
      const response = await queryRAG(question, context);
      const text = response?.isLLM ? response.text : resultSummary(result);
      setMessages((old) => [...old, { id: `a-${Date.now()}`, role: "assistant", text, timestamp: new Date(), isLLM: response?.isLLM }]);
    } catch (error) {
      setMessages((old) => [...old, { id: `a-${Date.now()}`, role: "assistant", text: error instanceof Error ? error.message : "No analysis has been run yet.", timestamp: new Date() }]);
    } finally {
      setTyping(false);
    }
  }, [input, mode, preset, result, selectedRegionId, typing]);

  return (
    <>
      <button className={`chatbot-toggle ${open ? "chatbot-toggle--open" : ""}`} type="button" aria-label={open ? "Close Globe Assistant" : "Open Globe Assistant"} onClick={() => { setOpen(!open); if (!open) setTimeout(() => inputRef.current?.focus(), 300); }}>
        {open ? <X size={21} /> : <><Brain size={18} /><span className="chatbot-toggle-label">Result Assistant</span></>}
      </button>
      {open && (
        <div className="chatbot-panel" role="dialog" aria-label="TERRASCAN Result Assistant">
          <div className="chatbot-header">
            <div className="chatbot-header-left"><Brain size={16} /><span className="chatbot-title">RESULT ASSISTANT</span></div>
            <div className="chatbot-header-right">
              <button type="button" className="rag-status-badge" onClick={() => setKeyModal(true)}><Sparkles size={11} /> {status === "ready" ? "AI explanation" : "Catalogue only"}</button>
              <button type="button" className="mode-toggle" onClick={() => setMode(mode === "simple" ? "expert" : "simple")}>{mode}</button>
            </div>
          </div>
          <div className="chatbot-messages">
            {messages.map((message) => <div key={message.id} className={`chat-msg chat-msg--${message.role}`}><div className="chat-bubble">{message.isLLM && <small>AI-generated explanation · </small>}{message.text}</div></div>)}
            {typing && <div className="chat-msg chat-msg--assistant"><div className="chat-bubble chat-bubble--typing">…</div></div>}
            <div ref={endRef} />
          </div>
          <div className="chatbot-input-row">
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Ask about the computed result" aria-label="Ask about the computed result" />
            <button type="button" onClick={() => void send()} aria-label="Send"><Send size={16} /></button>
          </div>
          {keyModal && <div className="chatbot-key-modal"><label><Key size={14} /> Gemini key (optional)<input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} /></label><button type="button" onClick={() => void connect()}><Check size={14} /> Connect</button>{getRAGError() && <p className="field-error">{getRAGError()}</p>}</div>}
        </div>
      )}
    </>
  );
}
