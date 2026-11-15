import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Check, Key, Send, Sparkles, X } from "lucide-react";
import type { AnalysisResult, Registries } from "./types";
import { getActiveKey, getRAGError, initRAG, proposeCandidateVariables, queryRAG, saveActiveKey, type RAGContext, type RAGStatus } from "./ragService";
import { scanTrends, type ScannerResult } from "./lib/scanner";
import { FIRST_YEAR, LAST_COMPLETE_YEAR } from "./data";
import { VARIABLES } from "./lib/variables";
import { findPlace } from "./theme";
import { getCopy, type Language } from "./i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isLLM?: boolean;
}

interface AssistantProps {
  language: Language;
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

export default function ChatBot({ language, result, selectedRegionId, preset, registries: _registries }: AssistantProps) {
  const copy = getCopy(language);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RAGStatus>("idle");
  const [keyModal, setKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState(getActiveKey());
  const [mode, setMode] = useState<"simple" | "expert">("simple");
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [candidateMode, setCandidateMode] = useState(false);
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [candidateReason, setCandidateReason] = useState("");
  const [candidateScan, setCandidateScan] = useState<{ status: "idle" | "loading" | "ready" | "error"; result: ScannerResult | null; error: string | null }>({ status: "idle", result: null, error: null });
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: result ? resultSummary(result) : copy.assistant.noResult, timestamp: new Date() },
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
    if (candidateMode) {
      try {
        let ids = candidateIds;
        let reason = candidateReason;
        if (status === "ready") {
          const proposal = await proposeCandidateVariables(question);
          ids = proposal.variables;
          reason = proposal.reason;
          setCandidateIds(ids);
          setCandidateReason(reason);
        }
        if (!ids.length) {
          setMessages((old) => [...old, { id: `a-${Date.now()}`, role: "assistant", text: status === "ready" ? reason : copy.assistant.choose, timestamp: new Date() }]);
          return;
        }
        const selectedPlace = findPlace(selectedRegionId);
        if (!selectedPlace) throw new Error("No place is selected for the candidate scan.");
        setCandidateScan({ status: "loading", result: null, error: null });
        const scannerResult = await scanTrends({ lat: selectedPlace.lat, lon: selectedPlace.lon, startYear: FIRST_YEAR, endYear: LAST_COMPLETE_YEAR, variableIds: ids });
        setCandidateScan({ status: "ready", result: scannerResult, error: null });
        const response = await queryRAG(question, {
          selectedRegion: selectedRegionId,
          regionName: selectedRegionId,
          preset,
          mode,
          language,
          result: scannerResult,
          conversationHistory: [],
        });
        setMessages((old) => [...old, { id: `a-${Date.now()}`, role: "assistant", text: response?.isLLM ? response.text : "Computed candidate scan is ready below.", timestamp: new Date(), isLLM: response?.isLLM }]);
      } catch (error) {
        const text = error instanceof Error ? error.message : "The candidate scan failed.";
        setCandidateScan({ status: "error", result: null, error: text });
        setMessages((old) => [...old, { id: `a-${Date.now()}`, role: "assistant", text, timestamp: new Date() }]);
      } finally {
        setTyping(false);
      }
      return;
    }
    const context: RAGContext = {
      selectedRegion: selectedRegionId,
      regionName: selectedRegionId,
      preset,
      mode,
      language,
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
  }, [candidateIds, candidateMode, candidateReason, input, language, mode, preset, result, selectedRegionId, status, typing]);

  const toggleCandidate = () => {
    setCandidateMode((current) => !current);
    setCandidateScan({ status: "idle", result: null, error: null });
  };

  return (
    <>
      <button className={`chatbot-toggle ${open ? "chatbot-toggle--open" : ""}`} type="button" aria-label={open ? copy.assistant.close : copy.assistant.open} onClick={() => { setOpen(!open); if (!open) setTimeout(() => inputRef.current?.focus(), 300); }}>
        {open ? <X size={21} /> : <><Brain size={18} /><span className="chatbot-toggle-label">{copy.assistant.open}</span></>}
      </button>
      {open && (
        <div className="chatbot-panel" role="dialog" aria-label={copy.assistant.title}>
          <div className="chatbot-header">
            <div className="chatbot-header-left"><span className="chatbot-avatar"><Brain size={17} /></span><div><span className="chatbot-title">{copy.assistant.title}</span><small className="chatbot-subtitle">Only explains computed results</small></div></div>
            <div className="chatbot-header-right">
              <button type="button" className="rag-status-badge" onClick={() => setKeyModal(true)}><Sparkles size={11} /> {status === "ready" ? copy.assistant.ai : copy.assistant.catalogue}</button>
              <button type="button" className="mode-toggle" onClick={() => setMode(mode === "simple" ? "expert" : "simple")}>{mode === "simple" ? copy.assistant.simple : copy.assistant.expert}</button>
            </div>
          </div>
          <div className="chatbot-flow-row">
            <button type="button" className={`mode-toggle ${candidateMode ? "is-on" : ""}`} onClick={toggleCandidate}>✨ {copy.assistant.find}</button>
          </div>
          {candidateMode && (
            <div className="candidate-picker">
              <strong>{status === "ready" ? "Describe the context for AI candidates." : "Choose catalogue variables to scan."}</strong>
              <div className="candidate-options">
                {VARIABLES.map((variable) => (
                  <label key={variable.id}><input type="checkbox" checked={candidateIds.includes(variable.id)} onChange={() => setCandidateIds((ids) => ids.includes(variable.id) ? ids.filter((id) => id !== variable.id) : [...ids, variable.id])} />{variable.short_name}</label>
                ))}
              </div>
              {candidateReason && <p>{candidateReason}</p>}
              {candidateScan.status === "loading" && <p role="status">{copy.assistant.scanning}</p>}
              {candidateScan.error && <p className="field-error">{candidateScan.error}</p>}
              {candidateScan.result && <div className="candidate-results" aria-label="Candidate scan results">{candidateScan.result.rows.map((row) => <div key={row.variable.id}><strong>{row.variable.short_name}</strong><span>{row.trend ? `${row.trend.direction ?? "unknown"} · p=${row.adjustedP ?? "not reported"} · ${row.units}` : row.error ?? "Insufficient data"}</span></div>)}</div>}
            </div>
          )}
          <div className="chatbot-messages">
            {messages.map((message) => <div key={message.id} className={`chat-msg chat-msg--${message.role}`}><div className="chat-bubble">{message.isLLM && <small>AI-generated explanation · </small>}{message.text}</div></div>)}
            {typing && <div className="chat-msg chat-msg--assistant"><div className="chat-bubble chat-bubble--typing">…</div></div>}
            <div ref={endRef} />
          </div>
          <div className="chatbot-input-row">
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder={copy.assistant.ask} aria-label={copy.assistant.ask} />
            <button type="button" onClick={() => void send()} aria-label="Send"><Send size={16} /></button>
          </div>
          {keyModal && <div className="chatbot-key-modal"><label><Key size={14} /> {copy.assistant.key}<input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} /></label><a className="chatbot-key-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get a key from Google AI Studio</a><button type="button" onClick={() => void connect()}><Check size={14} /> {copy.assistant.connect}</button>{getRAGError() && <p className="field-error">{getRAGError()}</p>}</div>}
        </div>
      )}
    </>
  );
}
