"use client";

// 可玩 demo 导航页，用于展示所有单机实验模式入口。
import Link from "next/link";
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { GameArt, gameArtwork } from "@/components/game-art";
import { SiteFooter, WorkspaceNav } from "@/components/workspace-nav";
import { playHubContent, translations } from "@/lib/content";
import type { GameKey, Locale } from "@/lib/types";

const genres: GameKey[] = ["pokemon-battle-demo", "moba-postmatch-demo", "rpg-build-demo"];

const modes = [
  { href: "/play/pokemon-duel", key: "pokemon-duel" },
  { href: "/play/heroes-and-monsters", key: "heroes-and-monsters" },
  { href: "/play/moba-lane", key: "moba-lane" },
  { href: "/play/moba-sandbox", key: "moba-sandbox" },
  { href: "/play/rpg-build-lab", key: "rpg-build-lab" },
  { href: "/play/survivor-sandbox", key: "survivor-sandbox" },
] as const;

export default function PlayHubPage() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryLocale = params.get("lang");
    if (queryLocale === "en" || queryLocale === "zh") {
      setLocale(queryLocale);
      return;
    }
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (storedLocale === "en" || storedLocale === "zh") {
      setLocale(storedLocale);
    }
  }, []);

  const t = playHubContent[locale];
  const common = translations[locale];

  return (
    <main lang={locale === "zh" ? "zh-CN" : "en"} className="gb-page min-h-screen px-5 py-6 text-ink sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <WorkspaceNav current="play" locale={locale} />
        <div className="gb-issue-line items-center">
          <span>GAME INDEX / {locale === "zh" ? "可玩原型目录" : "Playable prototypes"}</span>
          <div className="flex flex-wrap items-center gap-3">
            <LocaleSwitcher locale={locale} label={common.langLabel} onLocaleChange={setLocale} />
            <Link href={`/?lang=${locale}`} className="gb-button-light border-ink bg-white px-4 py-2 text-xs font-semibold transition-colors hover:bg-ink hover:text-white">
              ← {t.back}
            </Link>
          </div>
        </div>

        <header className="grid gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_12rem] lg:items-end">
          <div>
            <p className="gb-kicker">{t.eyebrow} / GAME INDEX</p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{t.title}</h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/65 sm:text-base">{t.description}</p>
          </div>
          <div className="flex items-center gap-4 border-l-4 border-ember bg-gold px-5 py-4 lg:block">
            <span className="font-mono text-5xl font-bold leading-none lg:text-6xl">{String(modes.length).padStart(2, "0")}</span>
            <p className="font-mono text-[10px] font-semibold uppercase leading-5 tracking-[0.12em] lg:mt-3">{locale === "zh" ? "个可玩模块" : "Playable modules"}<br /><span className="font-normal text-ink/65">IN YOUR BROWSER</span></p>
          </div>
        </header>

        <div className="mb-8 grid grid-cols-3 border-y border-l border-ink/30">
          {genres.map((genre) => <figure key={genre} className="min-w-0 border-r border-ink/30 bg-white"><GameArt game={genre} className="aspect-[1.35] sm:aspect-[2.3]" /><figcaption className="flex flex-wrap justify-between gap-1 border-t border-ink/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]"><span>{locale === "zh" ? gameArtwork[genre].label : gameArtwork[genre].english}</span><span className="text-ink/65">{locale === "zh" ? "类型插画" : "Illustration"}</span></figcaption></figure>)}
        </div>

        <section aria-label={t.eyebrow} className="border-y-2 border-ink">
          <div className="hidden grid-cols-[4rem_1.1fr_1.2fr_8rem] gap-6 border-b border-ink bg-ink px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white md:grid lg:grid-cols-[5rem_1.1fr_1.2fr_8rem]">
            <span>NO.</span><span>{locale === "zh" ? "游戏模块" : "Game module"}</span><span>{locale === "zh" ? "玩法概要" : "What you play"}</span><span className="text-right">{locale === "zh" ? "开始" : "Launch"}</span>
          </div>
          <div className="divide-y divide-ink/30">{modes.map((mode, index) => (
            <article key={mode.href} className="group grid grid-cols-[2.5rem_1fr] items-start gap-x-4 gap-y-4 px-3 py-6 transition-colors hover:bg-white sm:px-5 md:grid-cols-[4rem_1.1fr_1.2fr_8rem] md:items-center md:gap-6 md:py-8 lg:grid-cols-[5rem_1.1fr_1.2fr_8rem]">
              <span aria-hidden="true" className="font-mono text-2xl font-bold leading-none text-ember sm:text-3xl md:text-4xl">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink/65">{t.modes[mode.key].tag}</p><h2 className="mt-2 text-xl font-semibold leading-7 group-hover:text-ember lg:text-2xl">{t.modes[mode.key].title}</h2></div>
              <p className="col-start-2 text-sm leading-7 text-ink/65 md:col-start-auto">{t.modes[mode.key].description}</p>
              <Link href={`${mode.href}?lang=${locale}`} className="gb-button-light col-start-2 inline-flex w-fit items-center justify-between gap-4 border-ink bg-white px-3 py-3 text-xs font-semibold transition-colors hover:bg-ink hover:text-white md:col-start-auto md:w-full">
                {t.open}<span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}</div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3 py-5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/65"><span>GAMEBUDDY / PLAYABLE PROTOTYPES</span><span>{locale === "zh" ? "选择模块，直接开局。" : "Pick a mode. Start playing."}</span></div>
        <SiteFooter locale={locale} />
      </div>
    </main>
  );
}
