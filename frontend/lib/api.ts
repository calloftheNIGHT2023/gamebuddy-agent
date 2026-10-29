import { apiRequest, jsonPost } from "@/lib/api-client";
import type { MemoryGame, PlayerMemory } from "@/lib/types";
import type { AnalysisHistoryItem, AnalysisResponse, FeedbackItem, FeedbackRequest, GameKey, GameState, UserProfile } from "@/lib/types";

// Saved profiles are resolved by the server. A stale browser draft must not
// overwrite a preference the player just corrected in another conversation.
function profileReference(profile?: UserProfile | null) {
  return profile?.user_id?.trim() ? { user_id: profile.user_id.trim() } : profile ?? undefined;
}

export function analyzeState(game: GameKey, question: string, state: GameState, options?: { sessionId?: string; userProfile?: UserProfile | null }): Promise<AnalysisResponse> {
  return apiRequest("/analyze/state", jsonPost({ game, question, state, session_id: options?.sessionId, user_profile: profileReference(options?.userProfile) }));
}

export function analyzeScreenshot(game: GameKey, question: string, file: File, options?: { sessionId?: string; userProfile?: UserProfile | null }): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("game", game);
  formData.append("question", question);
  formData.append("file", file);
  if (options?.sessionId) formData.append("session_id", options.sessionId);
  if (options?.userProfile) formData.append("user_profile_json", JSON.stringify(profileReference(options.userProfile)));
  return apiRequest("/analyze/screenshot", { method: "POST", body: formData });
}

export const getUserProfile = (userId: string) => apiRequest<UserProfile | null>(`/memory/profile/${encodeURIComponent(userId)}`);
export const saveUserProfile = (profile: UserProfile) => apiRequest<UserProfile>("/memory/profile", jsonPost(profile));

export function getPlayerMemories(userId: string, game?: MemoryGame) {
  const search = new URLSearchParams({ user_id: userId });
  if (game) search.set("game", game);
  return apiRequest<PlayerMemory[]>(`/memory/items?${search}`);
}
export const savePlayerMemory = (payload: { user_id: string; game: MemoryGame | null; kind: PlayerMemory["kind"]; key: string; content: string; ttl_days: number | null; expected_revision: number }) => apiRequest<PlayerMemory>("/memory/items", jsonPost(payload));
export const editPlayerMemory = (item: PlayerMemory, content: string, ttlDays: number | null) => apiRequest<PlayerMemory>(`/memory/items/${encodeURIComponent(item.id)}`, { ...jsonPost({ user_id: item.user_id, content, ttl_days: ttlDays, expected_revision: item.revision }), method: "PUT" });
export const forgetPlayerMemory = (item: PlayerMemory) => apiRequest<void>(`/memory/items/${encodeURIComponent(item.id)}?${new URLSearchParams({ user_id: item.user_id, expected_revision: String(item.revision) })}`, { method: "DELETE" });

export function getAnalysisHistory(params: { userId?: string; sessionId?: string; limit?: number }): Promise<AnalysisHistoryItem[]> {
  const search = new URLSearchParams();
  if (params.userId) search.set("user_id", params.userId);
  if (params.sessionId) search.set("session_id", params.sessionId);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest(`/memory/history${query ? `?${query}` : ""}`);
}

export const saveFeedback = (payload: FeedbackRequest) => apiRequest<FeedbackItem>("/memory/feedback", jsonPost(payload));
