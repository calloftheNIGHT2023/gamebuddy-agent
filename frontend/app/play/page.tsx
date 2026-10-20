"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameArt } from "@/components/game-art";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SiteFooter, WorkspaceNav } from "@/components/workspace-nav";
import { playHubContent, translations } from "@/lib/content";
import type { GameKey, Locale } from "@/lib/types";

const originals: { scene: string; art: GameKey; title: string; english: string; genre: string; description: string; enDescription: string }[] = [
  { scene: "town", art: "pokemon-battle-demo", title: "松风镇", english: "Pinewind", genre: "探索 / 回合制", description: "沿着林间小路找回三份物资，在天黑前回到镇门。巡逻队在靠近，别忘了留点体力。", enDescription: "Gather three supply caches and return to the town gate before nightfall." },
  { scene: "river", art: "moba-postmatch-demo", title: "河谷争夺", english: "River Front", genre: "战术 / 夺旗", description: "利用两座桥穿过河谷，拿下三面旗。是先打掉守卫，还是从另一条路绕过去？", enDescription: "Cross the bridges, deal with the patrols and claim all three flags." },
  { scene: "dungeon", art: "rpg-build-demo", title: "地牢余火", english: "Last Ember", genre: "战斗 / 闯关", description: "带上两瓶药水，找齐符文再撤离。守卫不会等你回满体力，每个回合都得算。", enDescription: "Find the runes and escape the dungeon. Make every potion and every turn count." },
];
const modes = [
  { href: "/play/pokemon-duel", key: "pokemon-duel" },
  { href: "/play/heroes-and-monsters", key: "heroes-and-monsters" },
  { href: "/play/moba-lane", key: "moba-lane" },
  { href: "/play/moba-sandbox", key: "moba-sandbox" },
  { href: "/play/rpg-build-lab", key: "rpg-build-lab" },
  { href: "/play/survivor-sandbox", key: "survivor-sandbox" },
] as const;
export default function PlayHubPage() {
  const [locale, setLocale] = useState<Locale>("zh");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("lang");
    const stored = window.localStorage.getItem("gamebuddy:locale");
    if (query === "zh" || query === "en") setLocale(query);
    else if (stored === "zh" || stored === "en") setLocale(stored);
  }, []);
  const english = locale === "en";
  const t = playHubContent[locale];
  return <main lang={english ? "en" : "zh-CN"} className="gb-page">
    <WorkspaceNav current="play" locale={locale} />
    <div className="gb-issue-line items-center"><span>GAMEBUDDY / {english ? "THE ARCADE" : "游戏大厅"}</span><LocaleSwitcher locale={locale} label={translations[locale].langLabel} onLocaleChange={setLocale} /></div>
    <header className="py-10 md:py-14"><p className="gb-kicker text-ember">PICK A WORLD</p><h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{english ? "Where to tonight?" : "今晚，去哪里？"}</h1><p className="mt-5 text-sm leading-7 text-ink/65">{english ? "Pick a map and jump in. Your next move is yours to make." : "点开就能玩。走错了没关系，再开一局。"}</p></header>
    <div className="gb-game-grid">{originals.map((game, index) => <article key={game.scene} className="gb-native-card"><Link href={`/play/field-notes/?scene=${game.scene}`} className="gb-native-cover"><GameArt game={game.art} /><span className="sr-only">{english ? game.english : game.title}</span></Link><div className="gb-game-info"><div className="gb-game-tags"><span>0{index + 1} / {english ? game.english.toUpperCase() : game.genre}</span></div><h2 className="mb-3 mt-3 text-2xl font-black">{english ? game.english : game.title}</h2><p>{english ? game.enDescription : game.description}</p><Link className="gb-button mt-5 w-full justify-between" href={`/play/field-notes/?scene=${game.scene}`}><span>{english ? "Start playing" : "开局"}</span><span aria-hidden="true">↗</span></Link></div></article>)}</div>
    <section className="gb-section"><div className="gb-section-heading"><h2>{english ? "More games" : "再玩点别的"}</h2><span className="gb-kicker text-ink/65">06 / GAMES</span></div><div className="mt-4 divide-y divide-ink/20 border-b border-ink/30">{modes.map((mode, index) => <article key={mode.key} className="grid items-start gap-4 py-6 sm:grid-cols-[36px_1fr_auto] sm:items-center"><span className="font-mono text-sm text-ember">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><h3 className="text-lg font-bold">{t.modes[mode.key].title}</h3><p className="mt-2 max-w-3xl text-xs leading-6 text-ink/65">{t.modes[mode.key].description}</p></div><Link className="gb-button-light w-fit text-xs" href={`${mode.href}?lang=${locale}`}>{english ? "Play" : "开始游戏"} ↗</Link></article>)}</div></section>
    <SiteFooter locale={locale} />
  </main>;
}
