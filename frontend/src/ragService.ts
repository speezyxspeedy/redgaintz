import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { AnalysisResult } from "./types";
import { VARIABLES } from "./lib/variables";

const STORAGE_KEY = "TERRASCAN_GEMINI_KEY";
const LLM_MODEL = "gemini-2.0-flash-lite";

export type RAGStatus = "idle" | "initializing" | "ready" | "error" | "no-key";

export interface RAGContext {
  selectedRegion: string;
  regionName: string;
  preset: string;
  mode: "simple" | "expert";
  result: AnalysisResult | null;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
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

function resultContext(result: AnalysisResult | null): string {
  return result ? JSON.stringify(result) : "No analysis has been run yet.";
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
