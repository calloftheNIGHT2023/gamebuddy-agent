"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisPanel } from "@/components/analysis-panel";
import { ConnectionStatus } from "@/components/connection-status";
import { FieldGame } from "@/components/field-game";
import { GameArt } from "@/components/game-art";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MemoryPanel } from "@/components/memory-panel";
import { PromptList } from "@/components/prompt-list";
import { StateForm } from "@/components/state-form";
import { SiteFooter, WorkspaceNav } from "@/components/workspace-nav";
import { promptSets, translations } from "@/lib/content";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";
import type { SceneKey } from "@/lib/field-game";
import type { AnalysisResponse, GameKey, Locale, UserProfile } from "@/lib/types";

type Props = { samples: Record<GameKey, string>; initialLocale: Locale };
const DEFAULT_PROFILE: UserProfile = { user_id: "", display_name: null, skill_level: "intermediate", preferred_style: "balanced", favorite_role: null, favorite_character: null, goals: [], notes: [] };
const scenes: { key: SceneKey; art: GameKey; title: string; english: string; genre: string; intro: string; enIntro: string }[] = [
  { key: "town", art: "pokemon-battle-demo", title: "松风镇", english: "PINEWIND", genre: "探索 / 补给", intro: "天黑前，带齐三份物资回到镇门。别在路上耗尽体力。", enIntro: "Find three supply caches and get back to the town gate before nightfall." },
  { key: "river", art: "moba-postmatch-demo", title: "河谷争夺", english: "RIVER FRONT", genre: "战术 / 夺旗", intro: "绕开巡逻，或正面出击。渡过河口，拿下三处据点。", enIntro: "Slip past the patrols or fight your way across. Take all three flags." },
  { key: "dungeon", art: "rpg-build-demo", title: "地牢余火", english: "LAST EMBER", genre: "战斗 / 闯关", intro: "找到两枚符文，穿过守卫的房间。药水喝完之前，找到出口。", enIntro: "Claim two runes, get past the guards and find the way out." },
];
const copy = {
  zh: { issue: "GAMEBUDDY / 小游戏与战局复盘", top: "选条路，走走看。", kicker: "松风镇 · 河谷争夺 · 地牢余火", title: <>小镇天黑了。<br /><span className="text-gold">出发吧。</span></>, intro: "找补给、抢据点，或下地牢。三张地图，各有各的麻烦。卡住的时候，看看这一手怎么走。", start: "马上开局 ↓", choose: "换张地图 ↗", ribbon: ["走一格，局势就会变", "打不过，也能绕路", "看完建议，接着玩"], games: "今晚玩哪一个？", count: "三张地图，随时开局", selected: "已选中", enter: "选这张地图", play: "开局。", playIntro: "点相邻格移动，也可以用方向键或 WASD。", advanced: "分析其他对局", advancedHint: "宝可梦、MOBA、RPG · 导入局势", prompts: "也可以这样问", more: "还有六款小游戏", moreBody: "回合对战、单线攻防和生存沙盒，都在游戏大厅。", moreLink: "去游戏大厅 ↗" },
  en: { issue: "GAMEBUDDY / GAMES & FIELD NOTES", top: "Pick a path. See where it goes.", kicker: "PINEWIND · RIVER FRONT · LAST EMBER", title: <>Night is falling.<br /><span className="text-gold">Let&apos;s go.</span></>, intro: "Find supplies, take the river crossings or brave the dungeon. Three maps, three different problems. Stuck? Work out your next move, then keep playing.", start: "Start playing ↓", choose: "Choose a map ↗", ribbon: ["Every turn changes the board", "Fight, or find another route", "Get a tip. Keep playing."], games: "What's the plan tonight?", count: "Three maps, ready to play", selected: "Selected", enter: "Choose this map", play: "Your move.", playIntro: "Click an adjacent square, or use the arrow keys / WASD.", advanced: "Analyze another game", advancedHint: "Pokémon, MOBA, RPG · Import a position", prompts: "A few starting questions", more: "Six more games", moreBody: "Turn battles, lane fights and survival sandboxes in the arcade.", moreLink: "Enter the arcade ↗" },
};
function buildSessionId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `session-${Date.now()}`; }

export default function HomeClient({ samples, initialLocale }: Props) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [game, setGame] = useState<GameKey>("pokemon-battle-demo");
  const [scene, setScene] = useState<SceneKey>("town");
  const [sessionId, setSessionId] = useState("session-loading");
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const { health } = useConnectionStatus();
  const { hasToken } = useAdminAccess();
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
  const t = copy[locale];
  const selected = scenes.find((item) => item.key === scene)!;
  function selectGame(next: GameKey) { setGame(next); setResult(null); }
  return <main className="gb-page" lang={locale === "zh" ? "zh-CN" : "en"}>
    <WorkspaceNav current="home" locale={locale} />
    <div className="gb-issue-line"><span>{t.issue}</span><span>{t.top}</span></div>
    <section className="gb-hero" aria-labelledby="home-title">
      <div className="gb-hero-copy"><div><div className="gb-kicker text-gold">{t.kicker}</div><h1 id="home-title" className="gb-hero-heading">{t.title}</h1><p>{t.intro}</p></div><div className="gb-hero-actions"><a href="#play-desk">{t.start}</a><a href="#our-games">{t.choose}</a></div></div>
      <div className="gb-hero-art"><GameArt game={selected.art} priority /><div className="gb-hero-caption"><span className="text-ember">◆</span> {locale === "zh" ? selected.title : selected.english}</div></div>
    </section>
    <div className="gb-marquee">{t.ribbon.map((text, index) => <div key={text}><b>0{index + 1} /</b><span>{text}</span></div>)}</div>
    <section id="our-games" className="gb-section" aria-labelledby="games-title"><div className="gb-section-heading"><h2 id="games-title">{t.games}</h2><span className="gb-kicker font-normal text-ink/65">{t.count}</span></div>
      <div className="gb-game-grid">{scenes.map((item, index) => <button key={item.key} type="button" className="gb-game-choice" aria-pressed={scene === item.key} onClick={() => setScene(item.key)}><GameArt game={item.art} /><div className="gb-game-info"><div className="gb-game-tags"><span>0{index + 1} / {locale === "zh" ? item.genre : item.english}</span><em>{scene === item.key ? t.selected : "PLAY"}</em></div><h3>{locale === "zh" ? item.title : item.english}</h3><p>{locale === "zh" ? item.intro : item.enIntro}</p><div className="gb-game-open"><span>{scene === item.key ? t.selected : t.enter}</span><span aria-hidden="true">{scene === item.key ? "●" : "↗"}</span></div></div></button>)}</div>
    </section>
    <section id="play-desk" className="gb-section" aria-labelledby="play-title"><div className="gb-lab-header"><div><span className="gb-kicker text-ember">PLAY / {selected.english}</span><h2 id="play-title">{t.play}</h2></div><p>{t.playIntro}</p></div><div className="mt-5"><FieldGame key={scene} initialScene={scene} embedded onSceneChange={setScene} /></div></section>
    <details className="gb-section gb-advanced"><summary className="gb-section-heading cursor-pointer"><span>{t.advanced}</span><span className="text-xs font-normal text-ink/65">{t.advancedHint} ＋</span></summary><div className="pt-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><ConnectionStatus /><LocaleSwitcher locale={locale} label={translations[locale].langLabel} onLocaleChange={setLocale} /></div><div className="gb-lab-grid"><StateForm locale={locale} game={game} samples={samples} sessionId={sessionId} userProfile={userProfile} onGameChange={selectGame} onResult={setResult} /><AnalysisPanel result={result} locale={locale} sessionId={sessionId} userProfile={userProfile} /></div><div className="mt-6"><PromptList title={t.prompts} prompts={promptSets[game][locale]} /></div>{(health?.mode === "local" || hasToken) && <div className="mt-7"><MemoryPanel locale={locale} profile={userProfile} sessionId={sessionId} onProfileChange={setUserProfile} /></div>}</div></details>
    <section className="mt-10 flex flex-wrap items-center justify-between gap-6 border-y border-ink bg-gold px-6 py-7"><div><h2 className="text-2xl font-black tracking-tight">{t.more}</h2><p className="mt-2 text-xs text-ink/70">{t.moreBody}</p></div><Link className="gb-button" href={`/play?lang=${locale}`}>{t.moreLink}</Link></section>
    <SiteFooter locale={locale} />
  </main>;
}
