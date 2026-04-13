import { AnalysisResponse, GameKey, GameState } from "@/lib/types";

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

export async function analyzeState(game: GameKey, question: string, state: GameState): Promise<AnalysisResponse> {
  assertApiBase();
  const response = await fetch(`${API_BASE}/analyze/state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      game,
      question,
      state
    })
  });

  if (!response.ok) {
    throw new Error("Failed to analyze game state.");
  }

  return response.json();
}

export async function analyzeScreenshot(game: GameKey, question: string, file: File): Promise<AnalysisResponse> {
  assertApiBase();
  const formData = new FormData();
  formData.append("game", game);
  formData.append("question", question);
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/analyze/screenshot`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Failed to analyze screenshot.");
  }

  return response.json();
}
