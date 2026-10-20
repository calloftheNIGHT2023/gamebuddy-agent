// 示例提示词列表，帮助用户快速理解支持的提问方式。
type Props = {
  title: string;
  prompts: string[];
};

export function PromptList({ title, prompts }: Props) {
  return (
    <section className="gb-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink bg-gold px-5 py-3"><h3 className="text-sm font-semibold text-ink">{title}</h3><span aria-hidden="true" className="font-mono text-[10px] tracking-[0.12em] text-ink/65">FIELD NOTES</span></div>
      <ol className="grid text-sm text-ink/80 md:grid-cols-2">
        {prompts.map((prompt, index) => (
          <li key={prompt} className="flex items-start gap-4 border-b border-ink/15 px-5 py-4 last:border-b-0 md:odd:border-r">
            <span aria-hidden="true" className="mt-0.5 font-mono text-xs font-semibold text-ember">{String(index + 1).padStart(2, "0")}</span>
            <span className="leading-7">{prompt}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
