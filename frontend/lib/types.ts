export type Locale = "en" | "zh";

export type GameKey = "pokemon-battle-demo" | "moba-postmatch-demo" | "rpg-build-demo";

export type GameState = Record<string, unknown>;

export type AnalysisResponse = {
  summary: string;
  direction_prediction: {
    current_phase: string;
    best_direction: string;
    why_now: string;
    avoid_direction: string;
    confidence: "low" | "medium" | "high";
  };
  tactical_advice: {
    title: string;
    recommendation: string;
    reasoning: string;
    confidence: "low" | "medium" | "high";
  }[];
  beginner_explanation: string;
  risks_or_uncertainties: string[];
  next_steps: string[];
  review_report: {
    current_situation: string;
    likely_mistakes: string[];
    recommended_actions: string[];
    longer_term_improvement: string[];
  };
  metadata: Record<string, string | number>;
};
