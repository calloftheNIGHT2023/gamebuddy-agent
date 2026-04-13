import { AnalysisResponse, GameKey, GameState } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export async function analyzeState(game: GameKey, question: string, state: GameState): Promise<AnalysisResponse> {
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
