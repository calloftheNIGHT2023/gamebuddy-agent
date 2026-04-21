"use client";

// 轻量 MOBA 沙盒，通过本地状态机模拟资源与目标取舍。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/types";

type MobaState = {
  minute: number;
  goldDiff: number;
  deaths: number;
  vision: number;
  objective: "dragon" | "baron" | "tower";
  lanePriority: "low" | "medium" | "high";
  log: string[];
};

const copy = {
  en: {
    eyebrow: "MOBA Post-match Sandbox",
    title: "Playable macro review board.",
    reset: "Reset run",
    allGames: "All games",
    controls: "Match controls",
    minute: "Game minute",
    goldDiff: "Gold difference",
    deaths: "Deaths",
    vision: "Vision score",
    nextObjective: "Next objective",
    lanePriority: "Lane priority",
    groupEarly: "Group early",
    simulatePick: "Simulate pick",
    resetVision: "Reset for vision",
    currentRead: "Current read",
    reviewLog: "Review log",
    minuteUnit: "min",
    low: "Low",
    medium: "Medium",
    high: "High",
    dragon: "Dragon",
    baron: "Baron",
    tower: "Tower",
    statusBehind: "Behind: stop flipping fights and play for setup.",
    statusAhead: "Ahead: convert map control into objective pressure.",
    statusEven: "Even game: clean setup and synchronized timing will decide the next swing.",
    objectiveLine: (objective: string, lanePriority: string, vision: number) =>
      `Objective: ${objective} · Lane priority: ${lanePriority} · Vision: ${vision}`,
    initialLog: "You are preparing for the next objective window.",
    groupedLog: (objective: string) => `Team grouped early for ${objective}.`,
    pickLog: "A side lane overextended and got caught before the setup window.",
    visionLog: "Support refreshed vision and reset together before the fight.",
  },
  zh: {
    eyebrow: "MOBA 复盘沙盒",
    title: "可交互的宏观复盘板。",
    reset: "重置对局",
    allGames: "全部游戏",
    controls: "对局控制",
    minute: "游戏时间",
    goldDiff: "经济差",
    deaths: "死亡数",
    vision: "视野分",
    nextObjective: "下个资源点",
    lanePriority: "兵线优先级",
    groupEarly: "提前集合",
    simulatePick: "模拟被抓",
    resetVision: "重做视野",
    currentRead: "当前判断",
    reviewLog: "复盘记录",
    minuteUnit: "分钟",
    low: "低",
    medium: "中",
    high: "高",
    dragon: "小龙",
    baron: "大龙",
    tower: "防御塔",
    statusBehind: "处于劣势：不要硬接不清楚的团，先把布置做好。",
    statusAhead: "处于优势：把地图控制转成资源点压力。",
    statusEven: "局势接近：下一波胜负更取决于布置和到位时机。",
    objectiveLine: (objective: string, lanePriority: string, vision: number) =>
      `目标：${objective} · 兵线优先级：${lanePriority} · 视野：${vision}`,
    initialLog: "你正在为下一个资源点窗口做准备。",
    groupedLog: (objective: string) => `队伍已经提前围绕${objective}集合。`,
    pickLog: "边路有人压得太深，在布置窗口前被先手抓死。",
    visionLog: "辅助补完视野后与队友一起回补，重新准备团战。",
  },
} as const;

const initialState = (locale: Locale): MobaState => ({
  minute: 18,
  goldDiff: -1200,
  deaths: 4,
  vision: 46,
  objective: "dragon",
  lanePriority: "medium",
  log: [copy[locale].initialLog],
});

export function MobaSandbox({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, setState] = useState<MobaState>(initialState(initialLocale));
  const t = copy[locale];

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

  useEffect(() => {
    const raw = window.localStorage.getItem("gamebuddy:moba-save");
    if (raw) {
      try {
        setState(JSON.parse(raw) as MobaState);
      } catch {
        window.localStorage.removeItem("gamebuddy:moba-save");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("gamebuddy:moba-save", JSON.stringify(state));
  }, [state]);

  const status = useMemo(() => {
    if (state.goldDiff <= -2500 || state.deaths >= 7) {
      return t.statusBehind;
    }
    if (state.goldDiff >= 1500 && state.vision >= 55) {
      return t.statusAhead;
    }
    return t.statusEven;
  }, [state, t]);

  function pushLog(message: string) {
    setState((current) => ({ ...current, log: [message, ...current.log].slice(0, 8) }));
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f3f0e6_0%,#e7eff3_100%)] px-6 py-8 text-ink md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ember">{t.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl">{t.title}</h1>
          </div>
          <div className="flex gap-3">
            <LocaleSwitcher locale={locale} label={locale === "zh" ? "语言" : "Language"} onLocaleChange={setLocale} />
            <button
              type="button"
              onClick={() => {
                setState(initialState(locale));
                window.localStorage.removeItem("gamebuddy:moba-save");
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
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.controls}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="rounded-[1.4rem] bg-mist p-4">
                <span className="text-sm font-semibold">{t.minute}</span>
                <input type="range" min={8} max={38} value={state.minute} onChange={(event) => setState((current) => ({ ...current, minute: Number(event.target.value) }))} className="mt-3 w-full" />
                <p className="mt-2 text-sm text-ink/65">{state.minute} {t.minuteUnit}</p>
              </label>
              <label className="rounded-[1.4rem] bg-mist p-4">
                <span className="text-sm font-semibold">{t.goldDiff}</span>
                <input type="range" min={-5000} max={5000} step={100} value={state.goldDiff} onChange={(event) => setState((current) => ({ ...current, goldDiff: Number(event.target.value) }))} className="mt-3 w-full" />
                <p className="mt-2 text-sm text-ink/65">{state.goldDiff}</p>
              </label>
              <label className="rounded-[1.4rem] bg-mist p-4">
                <span className="text-sm font-semibold">{t.deaths}</span>
                <input type="range" min={0} max={12} value={state.deaths} onChange={(event) => setState((current) => ({ ...current, deaths: Number(event.target.value) }))} className="mt-3 w-full" />
                <p className="mt-2 text-sm text-ink/65">{state.deaths}</p>
              </label>
              <label className="rounded-[1.4rem] bg-mist p-4">
                <span className="text-sm font-semibold">{t.vision}</span>
                <input type="range" min={10} max={90} value={state.vision} onChange={(event) => setState((current) => ({ ...current, vision: Number(event.target.value) }))} className="mt-3 w-full" />
                <p className="mt-2 text-sm text-ink/65">{state.vision}</p>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="rounded-[1.4rem] bg-mist p-4">
                <span className="text-sm font-semibold">{t.nextObjective}</span>
                <select value={state.objective} onChange={(event) => setState((current) => ({ ...current, objective: event.target.value as MobaState["objective"] }))} className="mt-3 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3">
                  <option value="dragon">{t.dragon}</option>
                  <option value="baron">{t.baron}</option>
                  <option value="tower">{t.tower}</option>
                </select>
              </label>
              <label className="rounded-[1.4rem] bg-mist p-4">
                <span className="text-sm font-semibold">{t.lanePriority}</span>
                <select value={state.lanePriority} onChange={(event) => setState((current) => ({ ...current, lanePriority: event.target.value as MobaState["lanePriority"] }))} className="mt-3 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3">
                  <option value="low">{t.low}</option>
                  <option value="medium">{t.medium}</option>
                  <option value="high">{t.high}</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => pushLog(t.groupedLog(state.objective === "dragon" ? t.dragon : state.objective === "baron" ? t.baron : t.tower))} className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white">
                {t.groupEarly}
              </button>
              <button type="button" onClick={() => pushLog(t.pickLog)} className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white">
                {t.simulatePick}
              </button>
              <button type="button" onClick={() => pushLog(t.visionLog)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                {t.resetVision}
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.currentRead}</p>
              <h2 className="mt-3 text-2xl font-semibold">{status}</h2>
              <p className="mt-3 text-sm text-white/75">
                {t.objectiveLine(
                  state.objective === "dragon" ? t.dragon : state.objective === "baron" ? t.baron : t.tower,
                  state.lanePriority === "low" ? t.low : state.lanePriority === "medium" ? t.medium : t.high,
                  state.vision
                )}
              </p>
            </div>

            <div className="rounded-[2rem] bg-white/85 p-6 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.reviewLog}</p>
              <div className="mt-4 space-y-3 text-sm text-ink/72">
                {state.log.map((entry, index) => (
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
