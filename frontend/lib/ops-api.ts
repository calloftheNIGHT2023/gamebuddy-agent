import type { AnalysisResponse, FeedbackItem, FeedbackRating, GameKey, GameState } from "@/lib/types";
import { apiBlob, apiRequest as request, jsonPost } from "@/lib/api-client";

export type AssistantTask = "qa" | "build" | "review";

export type AssistantResponse = {
  answer: string;
  sources: { source: string; path: string; content: string; score: number }[];
  analysis: AnalysisResponse;
  evidence_status: "grounded" | "insufficient";
  trace_id: string;
};

export type OpsSummary = {
  total_requests: number;
  success_count: number;
  fallback_count: number;
  avg_latency_ms: number;
  feedback_count: number;
  eval_runs: number;
};

export type AgentTrace = {
  id: string;
  created_at: string;
  game: GameKey;
  task: string;
  question: string;
  status: string;
  latency_ms: number;
  policy_id: string | null;
  response: unknown;
  steps: { name: string; duration_ms: number; data: unknown }[];
};

export type AgentPolicy = {
  id: string;
  name: string;
  prompt: string;
  instructions: string;
  max_next_steps: number;
  created_at: string;
  active: boolean;
};

export type EvaluationRun = {
  id: string;
  created_at: string;
  policy_id: string | null;
  passed: number;
  total: number;
  checks: { name: string; passed: boolean; detail: string }[];
};

export function askAssistant(payload: { game: GameKey; task: AssistantTask; question: string; state: GameState; user_profile?: { user_id: string }; policy_id?: string }) {
  return request<AssistantResponse>("/assistant", jsonPost(payload));
}

export const getOpsSummary = () => request<OpsSummary>("/ops/summary");
export const getTraces = () => request<AgentTrace[]>("/ops/traces");
export const getTrace = (id: string) => request<AgentTrace>(`/ops/traces/${encodeURIComponent(id)}`);
export const getPolicies = () => request<AgentPolicy[]>("/ops/policies");
export const createPolicy = (payload: { name: string; prompt: string; instructions: string; max_next_steps: number }) => request<AgentPolicy>("/ops/policies", jsonPost(payload));
export const activatePolicy = (id: string) => request<AgentPolicy>(`/ops/policies/${encodeURIComponent(id)}/activate`, jsonPost());
export const getEvaluations = () => request<EvaluationRun[]>("/ops/evaluations");
export const runEvaluation = (policyId?: string) => request<EvaluationRun>("/ops/evaluations", jsonPost({ policy_id: policyId || undefined }));
export const annotateTrace = (id: string, payload: { rating: FeedbackRating; correction?: string; tags?: string[] }) => request<FeedbackItem>(`/ops/traces/${encodeURIComponent(id)}/feedback`, jsonPost(payload));

export async function downloadSamples(sampleType: "sft" | "preference") {
  const blob = await apiBlob(`/memory/training-samples.jsonl?sample_type=${sampleType}`);
  if (blob.size === 0) throw new Error("暂无符合条件的样本。请先为真实 Trace 添加反馈；SFT 需要正向反馈或修正回答，偏好数据需要修正回答。");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gamebuddy-${sampleType}.jsonl`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
