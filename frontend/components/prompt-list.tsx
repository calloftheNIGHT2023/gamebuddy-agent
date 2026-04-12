const prompts = [
  "What should I do next?",
  "What is my biggest mistake here?",
  "Give me 3 beginner tips for this position.",
  "What is the safest play if I want consistency?",
  "Which threat matters most right now?",
  "What should my win condition be from this state?",
  "How do I avoid throwing this lead?",
  "If I am behind, what stabilizes the game?",
  "What should I preserve for the late game?",
  "Explain this turn like I am new to strategy games."
];

export function PromptList() {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-card backdrop-blur">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-ember">Example prompts</p>
      <div className="grid gap-2 text-sm text-ink/80 md:grid-cols-2">
        {prompts.map((prompt) => (
          <div key={prompt} className="rounded-2xl border border-ink/10 bg-mist px-4 py-3">
            {prompt}
          </div>
        ))}
      </div>
    </div>
  );
}
