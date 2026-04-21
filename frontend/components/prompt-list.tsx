// 示例提示词列表，帮助用户快速理解支持的提问方式。
type Props = {
  title: string;
  prompts: string[];
};

export function PromptList({ title, prompts }: Props) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-card backdrop-blur">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-ember">{title}</p>
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
