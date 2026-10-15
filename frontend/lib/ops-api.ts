import type { AnalysisResponse, FeedbackItem, FeedbackRating, GameKey, GameState } from "@/lib/types";

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

function apiBase() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://localhost:8000/api/v1";
  }
  throw new Error("请配置 NEXT_PUBLIC_API_BASE_URL，指向后端的 /api/v1 地址。");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${apiBase()}${path}`, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const detail = body?.detail;
      const validation = Array.isArray(detail) ? detail.map((item: { loc?: (string | number)[]; msg?: string }) => `${item.loc?.filter((part) => part !== "body").join(".") || "输入"}：${item.msg || "格式不正确"}`).join("；") : null;
      throw new Error(typeof detail === "string" ? detail : validation || `请求失败（HTTP ${response.status}），请检查后端与输入。`);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("请求超时，请稍后重试。");
    if (error instanceof TypeError) throw new Error("无法连接后端，请确认 API 已启动且允许当前前端地址访问。");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function jsonPost(body?: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) };
}

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
  const response = await fetch(`${apiBase()}/memory/training-samples.jsonl?sample_type=${sampleType}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`导出失败（HTTP ${response.status}）。`);
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("暂无符合条件的样本。请先为真实 Trace 添加反馈；SFT 需要正向反馈或修正回答，偏好数据需要修正回答。");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gamebuddy-${sampleType}.jsonl`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
