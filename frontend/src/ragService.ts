import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { AnalysisResult } from "./types";
import { VARIABLES } from "./lib/variables";
import type { ScannerResult } from "./lib/scanner";
import type { Language } from "./i18n";

const STORAGE_KEY = "TERRASCAN_GEMINI_KEY";
const LLM_MODEL = "gemini-2.0-flash-lite";

export type RAGStatus = "idle" | "initializing" | "ready" | "error" | "no-key";

export interface RAGContext {
  selectedRegion: string;
  regionName: string;
  preset: string;
  mode: "simple" | "expert";
  language?: Language;
  result: AnalysisResult | ScannerResult | null;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface CandidateProposal {
  variables: string[];
  reason: string;
}

export interface RAGResponse {
  text: string;
  isLLM: boolean;
  retrievedDocs: Array<{ category: string; id: string }>;
}

let status: RAGStatus = "idle";
let errorMessage = "";
let llm: ChatGoogleGenerativeAI | null = null;
let activeKey = "";

export function getActiveKey(): string {
  if (activeKey) return activeKey;
  try {
    return (sessionStorage.getItem(STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function saveActiveKey(key: string): void {
  activeKey = key.trim();
  try {
    if (activeKey) sessionStorage.setItem(STORAGE_KEY, activeKey);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Keep the key in memory when browser storage is unavailable.
  }
}

export function getRAGError(): string {
  return errorMessage;
}

export function prepareDocuments(): Array<{ category: string; id: string; content: string }> {
  return VARIABLES.map((variable) => ({
    category: "catalogue",
    id: variable.id,
    content: `${variable.short_name} (${variable.id}): ${variable.definition} Units: ${variable.units_aggregated}. Caveat: ${variable.caveat}`,
  }));
}

function resultContext(result: AnalysisResult | ScannerResult | null): string {
  return result ? JSON.stringify(result) : "No analysis has been run yet.";
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? text).trim();
}

export function parseCandidateProposal(text: string): CandidateProposal {
  try {
    const parsed: unknown = JSON.parse(extractJson(text));
    if (!parsed || typeof parsed !== "object") return { variables: [], reason: "The model returned an invalid candidate response." };
    const record = parsed as { variables?: unknown; reason?: unknown };
    const variables = Array.isArray(record.variables)
      ? record.variables.filter((id): id is string => typeof id === "string" && VARIABLES.some((variable) => variable.id === id))
      : [];
    const reason = typeof record.reason === "string" ? record.reason : "No reason was supplied.";
    return { variables: [...new Set(variables)], reason };
  } catch {
    return { variables: [], reason: "The model returned malformed JSON. Choose variables from the catalogue instead." };
  }
}

export async function initRAG(customKey?: string): Promise<RAGStatus> {
  const key = (customKey ?? getActiveKey()).trim();
  if (!key) {
    status = "no-key";
    llm = null;
    return status;
  }
  status = "initializing";
  errorMessage = "";
  try {
    llm = new ChatGoogleGenerativeAI({ apiKey: key, model: LLM_MODEL, temperature: 0, maxOutputTokens: 800 });
    activeKey = key;
    status = "ready";
  } catch (error) {
    llm = null;
    status = "error";
    errorMessage = error instanceof Error ? error.message : "Could not initialise the explanation model.";
  }
  return status;
}

export async function queryRAG(question: string, context: RAGContext): Promise<RAGResponse | null> {
  if (!llm) return { text: "", isLLM: false, retrievedDocs: [] };
  const catalogue = prepareDocuments();
  const prompt = [
    "You are TERRASCAN's result explainer.",
    "Use only catalogue definitions and the supplied runtime analysis JSON.",
    "Never invent, estimate, round into a new claim, or provide any scientific number absent from the JSON.",
    "If the JSON says no analysis has been run yet, say exactly that and ask the user to run an analysis.",
    "Do not make causal claims. Mention units, source, and data origin when present in the JSON.",
    `Mode: ${context.mode}. Region: ${context.regionName} (${context.selectedRegion}).`,
    `Reply in ${context.language === "hi" ? "Hindi" : context.language === "mr" ? "Marathi" : context.language === "bn" ? "Bengali" : "English"} using short, simple sentences. Keep variable names and units unchanged.`,
    `Catalogue definitions: ${JSON.stringify(catalogue)}`,
    `Runtime analysis JSON: ${resultContext(context.result)}`,
    `Question: ${question}`,
  ].join("\n\n");
  try {
    const response = await llm.invoke(prompt);
    const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    return {
      text,
      isLLM: true,
      retrievedDocs: catalogue.map((doc) => ({ category: doc.category, id: doc.id })),
    };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "The explanation model failed.";
    return null;
  }

}

export async function proposeCandidateVariables(question: string): Promise<CandidateProposal> {
  if (!llm) return { variables: [], reason: "Add a Gemini key to ask AI for candidate variables." };
  const prompt = [
    "You are TERRASCAN's candidate-variable selector.",
    "Return ONLY valid JSON with exactly this shape: {\"variables\":[\"catalogue_id\"],\"reason\":\"short explanation\"}.",
    "Every variable must be copied exactly from the catalogue IDs below. Never return any other ID.",
    `Catalogue: ${JSON.stringify(VARIABLES.map((variable) => ({ id: variable.id, short_name: variable.short_name, definition: variable.definition })))}`,
    `User context: ${question}`,
  ].join("\n\n");
  try {
    const response = await llm.invoke(prompt);
    const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    return parseCandidateProposal(text);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "The candidate model failed.";
    return { variables: [], reason: "The candidate request failed. Choose variables from the catalogue instead." };
  }
}
