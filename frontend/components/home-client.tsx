"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisPanel } from "@/components/analysis-panel";
import { ConnectionStatus } from "@/components/connection-status";
import { GameArt, gameArtwork } from "@/components/game-art";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MemoryPanel } from "@/components/memory-panel";
import { PromptList } from "@/components/prompt-list";
import { StateForm } from "@/components/state-form";
import { SiteFooter, WorkspaceNav } from "@/components/workspace-nav";
import { promptSets, translations } from "@/lib/content";
import type { AnalysisResponse, GameKey, Locale, UserProfile } from "@/lib/types";

type Props = { samples: Record<GameKey, string>; initialLocale: Locale };
const DEFAULT_PROFILE: UserProfile = { user_id: "", display_name: null, skill_level: "intermediate", preferred_style: "balanced", favorite_role: null, favorite_character: null, goals: [], notes: [] };
const games: GameKey[] = ["pokemon-battle-demo", "moba-postmatch-demo", "rpg-build-demo"];
const editorial = {
  zh: {
    issue: "玩家手册 / 局势 · 知识 · 行动", issueRight: "把每一局，变成下一局的经验",
    kicker: "少一点盲打，多一点思路。", title: <>每个决定，<br />都值得<span className="text-gold">复盘。</span></>,
    intro: "从一次换人、一波团战，到一套角色配装。把局势讲清楚，找到有依据的下一步，再回到游戏里试一试。",
    start: "开始分析局势", assistant: "先问一个问题 ↗", image: "探索，战斗，再来一局。",
    strip: ["读懂当前局势", "找到建议的依据", "带着思路再开一局"],
    select: "选择你的战场", selectHint: "3 类演示游戏知识包", selected: "当前选择", choose: "选择此模式",
    titles: ["回合之间，留好后手。", "团战之后，看清全局。", "冒险之前，配好装备。"],
    descriptions: ["宝可梦回合制示例。保护核心、判断威胁，找到更稳的换人和进攻时机。", "MOBA 复盘示例。从资源、视野和团战中，梳理下一波应该围绕什么打。", "RPG 配装示例。结合已有属性与资源，在伤害、生存与续航之间做取舍。"],
    lab: "把你的局势，摆上桌面。", labBody: "选择游戏，填写状态与问题。结果会列出阶段判断、风险和下一步行动；信息不够时，也会直接说明。", prompts: "不知道从哪里问起？",
    play: "想直接开一局？", playBody: "六个浏览器原型，从回合对战到动作沙盒。", playCta: "进入游戏大厅 ↗",
  },
  en: {
    issue: "THE PLAYER'S PLAYBOOK / STATE · KNOWLEDGE · ACTION", issueRight: "A little wiser every round",
    kicker: "Less guesswork. Better decisions.", title: <>Every move.<br />A new <span className="text-gold">lesson.</span></>,
    intro: "A switch, a teamfight, a new build. Make sense of the position, find a grounded next step, then take it back into the game.",
    start: "Analyze a position", assistant: "Ask a question ↗", image: "Explore. Battle. Go again.",
    strip: ["Read the position", "Follow the evidence", "Take a better next step"],
    select: "Choose your arena", selectHint: "3 demo knowledge packs", selected: "Selected", choose: "Select this mode",
    titles: ["Keep a move in reserve.", "See beyond the teamfight.", "Build for the journey."],
    descriptions: ["A Pokémon battle demo. Preserve your closer, respect threats and find a safer pivot.", "A MOBA review demo. Revisit objectives, vision and the decisions before the next fight.", "An RPG build demo. Balance damage, survivability and sustain within your actual resources."],
    lab: "Put the position on the table.", labBody: "Choose a game and describe the state. Get a phase read, risks and practical next steps, with missing evidence made clear.", prompts: "A few good starting questions",
    play: "Ready for another round?", playBody: "Six browser prototypes, from turn battles to action sandboxes.", playCta: "Enter the arcade ↗",
  },
};

function buildSessionId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `session-${Date.now()}`; }

export default function HomeClient({ samples, initialLocale }: Props) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [game, setGame] = useState<GameKey>("pokemon-battle-demo");
  const [sessionId, setSessionId] = useState("session-loading");
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    const queryLocale = new URLSearchParams(window.location.search).get("lang");
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (queryLocale === "en" || queryLocale === "zh") setLocale(queryLocale);
    else if (storedLocale === "en" || storedLocale === "zh") setLocale(storedLocale);
  }, []);
  useEffect(() => { window.localStorage.setItem("gamebuddy:locale", locale); }, [locale]);
  useEffect(() => {
    const nextSessionId = window.localStorage.getItem("gamebuddy:session-id") || buildSessionId();
    window.localStorage.setItem("gamebuddy:session-id", nextSessionId); setSessionId(nextSessionId);
    const storedProfile = window.localStorage.getItem("gamebuddy:user-profile");
    if (!storedProfile) return;
    try { const parsed = JSON.parse(storedProfile) as UserProfile; setUserProfile({ ...DEFAULT_PROFILE, ...parsed, goals: parsed.goals ?? [], notes: parsed.notes ?? [] }); }
    catch { setUserProfile(DEFAULT_PROFILE); }
  }, []);
  useEffect(() => { window.localStorage.setItem("gamebuddy:user-profile", JSON.stringify(userProfile)); }, [userProfile]);
  const copy = editorial[locale];
  function selectGame(nextGame: GameKey) { setGame(nextGame); setResult(null); }

  return (
    <main className="gb-page" lang={locale === "zh" ? "zh-CN" : "en"}>
      <WorkspaceNav current="home" locale={locale} />
      <div className="gb-issue-line"><span>{copy.issue}</span><span>{copy.issueRight}</span></div>
      <section className="gb-hero" aria-labelledby="home-title">
        <div className="gb-hero-copy">
          <div><div className="gb-kicker text-gold">GAMEBUDDY / {copy.kicker}</div><h1 id="home-title" className="gb-hero-heading">{copy.title}</h1><p>{copy.intro}</p></div>
          <div className="gb-hero-actions"><a href="#analysis-desk">{copy.start} <span aria-hidden="true">↓</span></a><Link href={`/assistant?lang=${locale}`}>{copy.assistant}</Link></div>
        </div>
        <div className="gb-hero-art"><GameArt game={game} priority /><div className="gb-hero-caption"><span className="text-ember">◆</span> {copy.image}</div></div>
      </section>
      <div className="gb-marquee">{copy.strip.map((text, index) => <div key={text}><b>0{index + 1} /</b><span>{text}</span></div>)}</div>
      <section className="gb-section" aria-labelledby="arena-title">
        <div className="gb-section-heading"><h2 id="arena-title">{copy.select}</h2><span className="gb-kicker font-normal text-ink/65">{copy.selectHint}</span></div>
        <div className="gb-game-grid">{games.map((item, index) => <button key={item} type="button" className="gb-game-choice" aria-pressed={game === item} onClick={() => selectGame(item)}>
          <GameArt game={item} />
          <div className="gb-game-info"><div className="gb-game-tags"><span>{gameArtwork[item].code} / {locale === "zh" ? gameArtwork[item].label : gameArtwork[item].english}</span><em>{game === item ? copy.selected : gameArtwork[item].english}</em></div><h3>{copy.titles[index]}</h3><p>{copy.descriptions[index]}</p><div className="gb-game-open"><span>{game === item ? copy.selected : copy.choose}</span><span aria-hidden="true">{game === item ? "●" : "↗"}</span></div></div>
        </button>)}</div>
      </section>
      <section id="analysis-desk" className="gb-section" aria-labelledby="desk-title">
        <div className="gb-lab-header"><div><span className="gb-kicker text-ember">ANALYSIS DESK / 01</span><h2 id="desk-title">{copy.lab}</h2></div><LocaleSwitcher locale={locale} label={translations[locale].langLabel} onLocaleChange={setLocale} /></div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/65">{copy.labBody}</p>
        <div className="mt-5"><ConnectionStatus /></div>
        <div className="gb-lab-grid"><StateForm locale={locale} game={game} samples={samples} sessionId={sessionId} userProfile={userProfile} onGameChange={selectGame} onResult={setResult} /><AnalysisPanel result={result} locale={locale} sessionId={sessionId} userProfile={userProfile} /></div>
        <div className="mt-7"><PromptList title={copy.prompts} prompts={promptSets[game][locale]} /></div>
      </section>
      <section className="gb-section"><MemoryPanel locale={locale} profile={userProfile} sessionId={sessionId} onProfileChange={setUserProfile} /></section>
      <section className="mt-10 flex flex-wrap items-center justify-between gap-6 border-y border-ink bg-gold px-6 py-7"><div><h2 className="text-2xl font-black tracking-tight">{copy.play}</h2><p className="mt-2 text-xs text-ink/70">{copy.playBody}</p></div><Link className="gb-button" href={`/play?lang=${locale}`}>{copy.playCta}</Link></section>
      <SiteFooter locale={locale} />
    </main>
  );
}
