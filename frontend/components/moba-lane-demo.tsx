"use client";

// MOBA 对线单机 demo，聚焦补刀、换血和中立资源取舍。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/types";

type LaneState = {
  minute: number;
  hp: number;
  mana: number;
  gold: number;
  vision: number;
  yourTower: number;
  enemyTower: number;
  dragonStacks: number;
  enemyDragonStacks: number;
  enemyPressure: number;
  log: string[];
  ended: false | "win" | "lose";
};

const copy = {
  en: {
    eyebrow: "MOBA mini demo",
    title: "Single-lane solo match",
    body: "Juggle farming, vision, recalls, and objective timing in a compact single-player macro loop.",
    back: "All games",
    reset: "Reset match",
    controls: "Turn actions",
    currentRead: "Current read",
    battleLog: "Match log",
    farm: "Farm lane",
    trade: "Short trade",
    ward: "Ward river",
    recall: "Recall",
    dragon: "Contest dragon",
    stable: "Stable lane: keep gold flowing and avoid random fights.",
    danger: "Danger lane: your tower or HP is under too much pressure.",
    pressure: "Pressure lane: convert your edge into tower or dragon value.",
    win: "Victory. You broke the enemy tower and held objective control.",
    lose: "Defeat. Your lane collapsed before you could stabilize.",
    minute: (value: number) => `Minute ${value}`,
    hp: "HP",
    mana: "Mana",
    gold: "Gold",
    vision: "Vision",
    tower: "Tower HP",
    dragons: (you: number, enemy: number) => `Dragon stacks ${you} - ${enemy}`,
    farmLog: (gold: number) => `You last-hit cleanly and gained ${gold} gold.`,
    tradeLog: "You traded on the wave and forced the enemy back.",
    badTradeLog: "The trade went poorly and the enemy pushed you in.",
    wardLog: "You refreshed river vision before the next rotation.",
    recallLog: "You reset, healed up, and came back with a cleaner buy.",
    dragonLog: "You grouped early and secured the dragon.",
    dragonFailLog: "You arrived late and the enemy took the dragon.",
    emptyLog: "The lane is loading. Build a lead before the next objective.",
  },
  zh: {
    eyebrow: "MOBA 小 Demo",
    title: "单线单机对局",
    body: "在一个很短的单人宏观循环里处理补刀、视野、回城和资源团时机。",
    back: "全部游戏",
    reset: "重置对局",
    controls: "回合行动",
    currentRead: "当前判断",
    battleLog: "对局记录",
    farm: "补刀发育",
    trade: "换血试探",
    ward: "布置视野",
    recall: "回城补给",
    dragon: "争夺小龙",
    stable: "局势稳定：继续发育，不要乱接团。",
    danger: "危险局势：你的血量或防御塔压力过高。",
    pressure: "压制局势：把优势转成塔皮或资源价值。",
    win: "胜利。你已经推掉敌方防御塔并拿到资源优势。",
    lose: "失败。兵线和塔压已经失控。",
    minute: (value: number) => `第 ${value} 分钟`,
    hp: "生命",
    mana: "法力",
    gold: "金币",
    vision: "视野",
    tower: "防御塔血量",
    dragons: (you: number, enemy: number) => `小龙层数 ${you} - ${enemy}`,
    farmLog: (gold: number) => `你补刀顺利，获得了 ${gold} 金币。`,
    tradeLog: "你借兵线完成了一波换血，并把敌人压退。",
    badTradeLog: "这波换血亏了，敌方顺势把你压回塔下。",
    wardLog: "你提前补好了河道视野。",
    recallLog: "你完成回城补给，状态重新稳定。",
    dragonLog: "你提前到位并顺利拿下小龙。",
    dragonFailLog: "你到得太晚，敌方先拿走了小龙。",
    emptyLog: "兵线已经上线，先建立优势再考虑资源团。",
  },
} as const;

function createInitialState(): LaneState {
  return {
    minute: 6,
    hp: 84,
    mana: 72,
    gold: 450,
    vision: 48,
    yourTower: 100,
    enemyTower: 100,
    dragonStacks: 0,
    enemyDragonStacks: 0,
    enemyPressure: 42,
    log: [],
    ended: false,
  };
}

export function MobaLaneDemo({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, setState] = useState<LaneState>(createInitialState);
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

  const read = useMemo(() => {
    if (state.ended === "win") {
      return t.win;
    }
    if (state.ended === "lose") {
      return t.lose;
    }
    if (state.hp <= 28 || state.yourTower <= 34) {
      return t.danger;
    }
    if (state.gold >= 900 || state.enemyTower <= 42 || state.dragonStacks > state.enemyDragonStacks) {
      return t.pressure;
    }
    return t.stable;
  }, [state, t]);

  function pushLog(current: LaneState, message: string) {
    return [message, ...current.log].slice(0, 8);
  }

  function advance(next: LaneState) {
    if (next.enemyTower <= 0 || next.dragonStacks >= 2) {
      setState({ ...next, enemyTower: Math.max(0, next.enemyTower), ended: "win" });
      return;
    }
    if (next.yourTower <= 0 || next.hp <= 0 || next.enemyDragonStacks >= 2) {
      setState({ ...next, yourTower: Math.max(0, next.yourTower), hp: Math.max(0, next.hp), ended: "lose" });
      return;
    }
    setState(next);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(246,174,88,0.3),transparent_22%),linear-gradient(180deg,#f5f0e7_0%,#e4ecf4_100%)] px-6 py-8 text-ink md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ember">{t.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-ink/68">{t.body}</p>
          </div>
          <div className="flex gap-3">
            <LocaleSwitcher locale={locale} label={locale === "zh" ? "语言" : "Language"} onLocaleChange={setLocale} />
            <button type="button" onClick={() => setState(createInitialState())} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
              {t.reset}
            </button>
            <Link href={`/play?lang=${locale}`} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
              {t.back}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-[2rem] bg-white/86 p-6 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.controls}</p>
              <span className="rounded-full bg-mist px-4 py-2 text-sm text-ink/70">{t.minute(state.minute)}</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.5rem] bg-mist p-5">
                <p className="text-sm text-ink/70">{t.hp}</p>
                <h2 className="mt-2 text-3xl font-semibold">{state.hp}</h2>
                <p className="mt-4 text-sm text-ink/70">{t.mana} {state.mana}</p>
                <p className="mt-2 text-sm text-ink/70">{t.gold} {state.gold}</p>
                <p className="mt-2 text-sm text-ink/70">{t.vision} {state.vision}</p>
              </article>
              <article className="rounded-[1.5rem] bg-mist p-5">
                <p className="text-sm text-ink/70">{t.tower}</p>
                <h2 className="mt-2 text-3xl font-semibold">{state.yourTower} / {state.enemyTower}</h2>
                <p className="mt-4 text-sm text-ink/70">{t.dragons(state.dragonStacks, state.enemyDragonStacks)}</p>
              </article>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  advance({
                    ...state,
                    minute: state.minute + 1,
                    gold: state.gold + 110,
                    enemyPressure: Math.min(100, state.enemyPressure + 4),
                    yourTower: Math.max(0, state.yourTower - (state.vision >= 60 ? 4 : 8)),
                    log: pushLog(state, t.farmLog(110)),
                  })
                }
                className="rounded-[1.4rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold text-ink">{t.farm}</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  const wonTrade = state.hp >= 40 && state.mana >= 20;
                  advance({
                    ...state,
                    minute: state.minute + 1,
                    hp: Math.max(0, state.hp - (wonTrade ? 8 : 18)),
                    mana: Math.max(0, state.mana - 18),
                    enemyTower: Math.max(0, state.enemyTower - (wonTrade ? 14 : 0)),
                    enemyPressure: Math.max(10, state.enemyPressure + (wonTrade ? -10 : 8)),
                    log: pushLog(state, wonTrade ? t.tradeLog : t.badTradeLog),
                  });
                }}
                className="rounded-[1.4rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold text-ink">{t.trade}</p>
              </button>
              <button
                type="button"
                onClick={() =>
                  advance({
                    ...state,
                    minute: state.minute + 1,
                    vision: Math.min(100, state.vision + 18),
                    enemyPressure: Math.max(8, state.enemyPressure - 6),
                    log: pushLog(state, t.wardLog),
                  })
                }
                className="rounded-[1.4rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold text-ink">{t.ward}</p>
              </button>
              <button
                type="button"
                onClick={() =>
                  advance({
                    ...state,
                    minute: state.minute + 1,
                    hp: Math.min(100, state.hp + 26),
                    mana: Math.min(100, state.mana + 28),
                    yourTower: Math.max(0, state.yourTower - 12),
                    log: pushLog(state, t.recallLog),
                  })
                }
                className="rounded-[1.4rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold text-ink">{t.recall}</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  const success = state.hp >= 45 && state.vision >= 55;
                  advance({
                    ...state,
                    minute: state.minute + 1,
                    hp: Math.max(0, state.hp - (success ? 12 : 20)),
                    dragonStacks: state.dragonStacks + (success ? 1 : 0),
                    enemyDragonStacks: state.enemyDragonStacks + (success ? 0 : 1),
                    enemyPressure: success ? Math.max(10, state.enemyPressure - 12) : state.enemyPressure + 8,
                    log: pushLog(state, success ? t.dragonLog : t.dragonFailLog),
                  });
                }}
                className="rounded-[1.4rem] border border-ink/10 bg-white p-4 text-left md:col-span-2"
              >
                <p className="text-lg font-semibold text-ink">{t.dragon}</p>
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.currentRead}</p>
              <h2 className="mt-3 text-2xl font-semibold">{read}</h2>
              <p className="mt-3 text-sm text-white/75">{t.dragons(state.dragonStacks, state.enemyDragonStacks)}</p>
            </div>

            <div className="rounded-[2rem] bg-white/86 p-6 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.battleLog}</p>
              <div className="mt-4 space-y-3 text-sm text-ink/70">
                {state.log.length === 0 ? <p>{t.emptyLog}</p> : state.log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
