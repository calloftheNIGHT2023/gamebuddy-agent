"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/types";

type BuildState = {
  level: number;
  intelligence: number;
  vitality: number;
  manaRegen: number;
  crit: number;
  gold: number;
  focus: "burst" | "sustain" | "survival";
  notes: string[];
};

const copy = {
  en: {
    eyebrow: "RPG Build Lab",
    title: "Playable build tuning sandbox.",
    reset: "Reset build",
    allGames: "All games",
    sliders: "Build sliders",
    focus: "Build focus",
    favorSustain: "Favor sustain",
    fixWeak: "Fix weak slot",
    commit: "Commit build",
    verdict: "Current verdict",
    notes: "Build notes",
    labels: ["Level", "Intelligence", "Vitality", "Mana Regen", "Crit", "Gold"],
    focusOptions: { burst: "Burst", sustain: "Sustain", survival: "Survival" },
    initialNote: "Your mage build is preparing for a difficult tower boss.",
    sustainNote: "You shifted investment into mana stability for longer boss phases.",
    weakNote: "A luxury upgrade was delayed to fix the weakest item slot first.",
    commitNote: "Your build is now focused on one primary progression goal instead of hybrid spread.",
    verdictBurst: "High burst, but your mana economy is the first bottleneck.",
    verdictSurvival: "Very safe, but your build risks stalling progression because damage is too low.",
    verdictSustain: "Stable progression build: this should feel smooth for longer boss phases.",
    verdictDefault: "The build is functional, but one stat line should be pushed harder instead of spreading upgrades.",
    footer: (focus: string, gold: number) => `Focus: ${focus} · Gold: ${gold}`,
  },
  zh: {
    eyebrow: "RPG 配装实验室",
    title: "可交互的 Build 调整沙盒。",
    reset: "重置 Build",
    allGames: "全部游戏",
    sliders: "属性滑块",
    focus: "构筑方向",
    favorSustain: "偏向续航",
    fixWeak: "先补短板",
    commit: "锁定路线",
    verdict: "当前判断",
    notes: "Build 记录",
    labels: ["等级", "智力", "体力", "法力回复", "暴击", "金币"],
    focusOptions: { burst: "爆发", sustain: "续航", survival: "生存" },
    initialNote: "你的法师 Build 正在为一个难度较高的塔楼 Boss 做准备。",
    sustainNote: "你把资源转向了法力稳定性，方便更长的 Boss 二阶段作战。",
    weakNote: "你先处理最弱装备槽位，而不是继续追求奢侈升级。",
    commitNote: "你的 Build 已经从混搭状态转向一个更明确的主路线。",
    verdictBurst: "爆发很高，但当前第一瓶颈仍然是法力经济。",
    verdictSurvival: "生存很稳，但伤害偏低，可能会拖慢推进效率。",
    verdictSustain: "这是更稳定的推进型 Build，在长 Boss 战里会更顺手。",
    verdictDefault: "这套 Build 可以用，但应该更集中强化一条主属性，而不是平均分配。",
    footer: (focus: string, gold: number) => `方向：${focus} · 金币：${gold}`,
  },
} as const;

const initialBuild = (locale: Locale): BuildState => ({
  level: 28,
  intelligence: 72,
  vitality: 24,
  manaRegen: 14,
  crit: 11,
  gold: 9600,
  focus: "burst",
  notes: [copy[locale].initialNote],
});

export function RpgBuildLab({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [build, setBuild] = useState<BuildState>(initialBuild(initialLocale));
  const t = copy[locale];

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (storedLocale === "en" || storedLocale === "zh") {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("gamebuddy:rpg-save");
    if (raw) {
      try {
        setBuild(JSON.parse(raw) as BuildState);
      } catch {
        window.localStorage.removeItem("gamebuddy:rpg-save");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("gamebuddy:rpg-save", JSON.stringify(build));
  }, [build]);

  const verdict = useMemo(() => {
    if (build.focus === "burst" && build.intelligence > 80 && build.manaRegen < 18) return t.verdictBurst;
    if (build.focus === "survival" && build.vitality > 40 && build.intelligence < 55) return t.verdictSurvival;
    if (build.focus === "sustain" && build.manaRegen >= 20) return t.verdictSustain;
    return t.verdictDefault;
  }, [build, t]);

  function addNote(message: string) {
    setBuild((current) => ({ ...current, notes: [message, ...current.notes].slice(0, 8) }));
  }

  const labels = t.labels;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5efe9_0%,#ebf0e5_100%)] px-6 py-8 text-ink md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ember">{t.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl">{t.title}</h1>
          </div>
          <div className="flex gap-3">
            <LocaleSwitcher locale={locale} label={locale === "zh" ? "语言" : "Language"} />
            <button
              type="button"
              onClick={() => {
                setBuild(initialBuild(locale));
                window.localStorage.removeItem("gamebuddy:rpg-save");
              }}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card"
            >
              {t.reset}
            </button>
            <Link href={`/play?lang=${locale}`} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
              {t.allGames}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] bg-white/85 p-6 shadow-card">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.sliders}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                [labels[0], "level", 10, 60],
                [labels[1], "intelligence", 20, 120],
                [labels[2], "vitality", 10, 80],
                [labels[3], "manaRegen", 5, 40],
                [labels[4], "crit", 0, 40],
                [labels[5], "gold", 0, 30000],
              ].map(([label, key, min, max]) => (
                <label key={String(key)} className="rounded-[1.4rem] bg-mist p-4">
                  <span className="text-sm font-semibold">{label}</span>
                  <input type="range" min={Number(min)} max={Number(max)} value={build[key as keyof BuildState] as number} onChange={(event) => setBuild((current) => ({ ...current, [key]: Number(event.target.value) }))} className="mt-3 w-full" />
                  <p className="mt-2 text-sm text-ink/65">{build[key as keyof BuildState] as number}</p>
                </label>
              ))}
            </div>

            <label className="mt-4 block rounded-[1.4rem] bg-mist p-4">
              <span className="text-sm font-semibold">{t.focus}</span>
              <select value={build.focus} onChange={(event) => setBuild((current) => ({ ...current, focus: event.target.value as BuildState["focus"] }))} className="mt-3 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3">
                <option value="burst">{t.focusOptions.burst}</option>
                <option value="sustain">{t.focusOptions.sustain}</option>
                <option value="survival">{t.focusOptions.survival}</option>
              </select>
            </label>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => addNote(t.sustainNote)} className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white">
                {t.favorSustain}
              </button>
              <button type="button" onClick={() => addNote(t.weakNote)} className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white">
                {t.fixWeak}
              </button>
              <button type="button" onClick={() => addNote(t.commitNote)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                {t.commit}
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.verdict}</p>
              <h2 className="mt-3 text-2xl font-semibold">{verdict}</h2>
              <p className="mt-3 text-sm text-white/75">
                {t.footer(t.focusOptions[build.focus], build.gold)}
              </p>
            </div>

            <div className="rounded-[2rem] bg-white/85 p-6 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.notes}</p>
              <div className="mt-4 space-y-3 text-sm text-ink/72">
                {build.notes.map((entry, index) => (
                  <p key={`${entry}-${index}`}>{entry}</p>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
