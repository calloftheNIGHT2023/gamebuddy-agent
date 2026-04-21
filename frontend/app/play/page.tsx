"use client";

// 可玩 demo 导航页，用于展示所有单机实验模式入口。
import Link from "next/link";
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { playHubContent, translations } from "@/lib/content";
import type { Locale } from "@/lib/types";

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(231,193,121,0.35),transparent_26%),linear-gradient(180deg,#f6f1e8_0%,#e6edf0_100%)] px-6 py-10 text-ink md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ember">{t.eyebrow}</p>
            <h1 className="mt-3 font-display text-5xl leading-tight">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-base text-ink/72">{t.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} label={common.langLabel} onLocaleChange={setLocale} />
            <Link href={`/?lang=${locale}`} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
              {t.back}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {modes.map((mode) => (
            <article key={mode.href} className="rounded-[2rem] bg-white/85 p-6 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pine">{t.modes[mode.key].tag}</p>
              <h2 className="mt-3 text-2xl font-semibold">{t.modes[mode.key].title}</h2>
              <p className="mt-3 text-sm text-ink/68">{t.modes[mode.key].description}</p>
              <Link href={`${mode.href}?lang=${locale}`} className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
                {t.open}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
