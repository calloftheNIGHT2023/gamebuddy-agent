// 前端 API 封装层，统一处理分析、画像和历史记录请求。
import { AnalysisHistoryItem, AnalysisResponse, GameKey, GameState, UserProfile } from "@/lib/types";

function resolveApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000/api/v1";
    }
  }

  return "";
}

const API_BASE = resolveApiBase();

function assertApiBase() {
  if (!API_BASE) {
    throw new Error("API endpoint is not configured. Set NEXT_PUBLIC_API_BASE_URL for the deployed frontend.");
  }
}

export async function analyzeState(
  game: GameKey,
  question: string,
  state: GameState,
  options?: { sessionId?: string; userProfile?: UserProfile | null }
): Promise<AnalysisResponse> {
  assertApiBase();
  const response = await fetch(`${API_BASE}/analyze/state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      game,
      question,
      state,
      session_id: options?.sessionId,
      user_profile: options?.userProfile ?? undefined,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to analyze game state.");
  }

  return response.json();
}

export async function analyzeScreenshot(
  game: GameKey,
  question: string,
  file: File,
  options?: { sessionId?: string; userProfile?: UserProfile | null }
): Promise<AnalysisResponse> {
  assertApiBase();
  const formData = new FormData();
  formData.append("game", game);
  formData.append("question", question);
  formData.append("file", file);
  if (options?.sessionId) {
    formData.append("session_id", options.sessionId);
  }
  if (options?.userProfile) {
    formData.append("user_profile_json", JSON.stringify(options.userProfile));
  }

  const response = await fetch(`${API_BASE}/analyze/screenshot`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to analyze screenshot.");
  }

  return response.json();
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  assertApiBase();
  const response = await fetch(`${API_BASE}/memory/profile/${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error("Failed to load user profile.");
  }
  return response.json();
}

export async function saveUserProfile(profile: UserProfile): Promise<UserProfile> {
  assertApiBase();
  const response = await fetch(`${API_BASE}/memory/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    throw new Error("Failed to save user profile.");
  }
  return response.json();
}

export async function getAnalysisHistory(params: {
  userId?: string;
  sessionId?: string;
  limit?: number;
}): Promise<AnalysisHistoryItem[]> {
  assertApiBase();
  const search = new URLSearchParams();
  if (params.userId) {
    search.set("user_id", params.userId);
  }
  if (params.sessionId) {
    search.set("session_id", params.sessionId);
  }
  if (params.limit) {
    search.set("limit", String(params.limit));
  }

  const query = search.toString();
  const response = await fetch(`${API_BASE}/memory/history${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error("Failed to load analysis history.");
  }
  return response.json();
}
