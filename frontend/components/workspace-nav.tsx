import Link from "next/link";

export function WorkspaceNav({ current, locale = "zh" }: { current: "home" | "review" | "assistant" | "ops"; locale?: string }) {
  const english = locale === "en";
  const links = [
    { key: "home", href: "/", label: english ? "Analysis lab" : "局势分析" },
    { key: "assistant", href: "/assistant", label: english ? "Game assistant" : "游戏助手" },
    { key: "review", href: "/review", label: english ? "Review" : "复盘报告" },
    { key: "ops", href: "/ops", label: "Agent Ops" },
  ];
  return (
    <nav aria-label={english ? "Workspace navigation" : "工作区导航"} className="flex flex-wrap gap-2 text-sm">
      {links.map((link) => (
        <Link key={link.key} href={`${link.href}?lang=${locale}`} aria-current={current === link.key ? "page" : undefined}
          className={`rounded-full px-4 py-2 font-semibold transition ${current === link.key ? "bg-pine text-white" : "border border-ink/10 bg-white/80 text-ink/75 hover:bg-white"}`}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
