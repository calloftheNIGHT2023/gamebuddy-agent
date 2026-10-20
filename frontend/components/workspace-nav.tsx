import Link from "next/link";

export function WorkspaceNav({ current, locale = "zh" }: { current: "home" | "review" | "assistant" | "ops" | "play"; locale?: string }) {
  const english = locale === "en";
  const links = [
    { key: "home", href: "/", label: english ? "Analysis" : "局势分析" },
    { key: "assistant", href: "/assistant", label: english ? "Playbook" : "游戏助手" },
    { key: "review", href: "/review", label: english ? "Review" : "复盘报告" },
    { key: "ops", href: "/ops", label: "Agent Ops" },
  ];
  return (
    <header className="gb-masthead">
      <Link href={`/?lang=${locale}`} className="gb-brand" aria-label={english ? "GameBuddy home" : "GameBuddy 首页"}>
        <span className="gb-brand-mark" aria-hidden="true">
          <svg width="25" height="25" viewBox="0 0 25 25" fill="currentColor"><path d="M8 0h9v8h8v9h-8v8H8v-8H0V8h8z" /><path d="M10 10h5v5h-5z" fill="#e5f36a" /></svg>
        </span>
        <span className="gb-brand-name">GameBuddy<span className="gb-brand-caption">THE PLAYER&apos;S PLAYBOOK</span></span>
      </Link>
      <nav aria-label={english ? "Workspace navigation" : "工作区导航"} className="gb-nav-links">
        {links.map((link, index) => <Link key={link.key} href={`${link.href}?lang=${locale}`} aria-current={current === link.key ? "page" : undefined} className="gb-nav-link"><span>0{index + 1}</span>{link.label}</Link>)}
        <Link href={`/play?lang=${locale}`} aria-current={current === "play" ? "page" : undefined} className="gb-nav-link gb-nav-play">{english ? "Play now" : "游戏大厅"} <span aria-hidden="true">↗</span></Link>
      </nav>
    </header>
  );
}

export function SiteFooter({ locale = "zh" }: { locale?: string }) {
  const english = locale === "en";
  return <footer className="gb-footer">
    <div><strong>GameBuddy</strong> / {english ? "A better next move." : "让下一步，更有把握。"}<br />{english ? "Demo game packs. Advice is bounded by the available evidence." : "演示游戏知识包 · 建议以现有局势和知识来源为依据。"}</div>
    <div>{english ? "Scene artwork" : "场景插画"} © <a href="https://kenney.nl/assets" target="_blank" rel="noreferrer">Kenney</a> · CC0<br />{english ? "Artwork illustrates game genres; it is not a project screenshot." : "插画用于表达游戏类型，并非项目实录截图。"}</div>
  </footer>;
}
