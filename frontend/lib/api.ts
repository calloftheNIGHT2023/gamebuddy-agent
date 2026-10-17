import { apiRequest, jsonPost } from "@/lib/api-client";
import type { AnalysisHistoryItem, AnalysisResponse, FeedbackItem, FeedbackRequest, GameKey, GameState, UserProfile } from "@/lib/types";

export function analyzeState(game: GameKey, question: string, state: GameState, options?: { sessionId?: string; userProfile?: UserProfile | null }): Promise<AnalysisResponse> {
  return apiRequest("/analyze/state", jsonPost({ game, question, state, session_id: options?.sessionId, user_profile: options?.userProfile ?? undefined }));
}

export function analyzeScreenshot(game: GameKey, question: string, file: File, options?: { sessionId?: string; userProfile?: UserProfile | null }): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("game", game);
  formData.append("question", question);
  formData.append("file", file);
  if (options?.sessionId) formData.append("session_id", options.sessionId);
  if (options?.userProfile) formData.append("user_profile_json", JSON.stringify(options.userProfile));
  return apiRequest("/analyze/screenshot", { method: "POST", body: formData });
}

export const getUserProfile = (userId: string) => apiRequest<UserProfile | null>(`/memory/profile/${encodeURIComponent(userId)}`);
export const saveUserProfile = (profile: UserProfile) => apiRequest<UserProfile>("/memory/profile", jsonPost(profile));

export function getAnalysisHistory(params: { userId?: string; sessionId?: string; limit?: number }): Promise<AnalysisHistoryItem[]> {
  const search = new URLSearchParams();
  if (params.userId) search.set("user_id", params.userId);
  if (params.sessionId) search.set("session_id", params.sessionId);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest(`/memory/history${query ? `?${query}` : ""}`);
}

export const saveFeedback = (payload: FeedbackRequest) => apiRequest<FeedbackItem>("/memory/feedback", jsonPost(payload));
