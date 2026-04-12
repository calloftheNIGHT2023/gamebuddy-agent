export type Combatant = {
  name: string;
  archetype: string;
  current_hp_percent: number;
  known_moves: string[];
  status?: string | null;
  speed_tier: "slow" | "medium" | "fast";
  likely_role: string;
};

export type TeamSnapshot = {
  active: Combatant;
  bench: Combatant[];
  hazards: string[];
  momentum: "behind" | "neutral" | "ahead";
};

export type BattleState = {
  battle_id: string;
  turn: number;
  format: string;
  skill_level: "beginner" | "intermediate" | "advanced";
  player: TeamSnapshot;
  opponent: TeamSnapshot;
  revealed_threats: string[];
  recent_events: string[];
  win_condition_hint?: string | null;
};

export type AnalysisResponse = {
  summary: string;
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
