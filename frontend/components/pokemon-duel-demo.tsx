"use client";

// 宝可梦单机对战 demo，使用本地回合制状态机模拟 1v1 决策。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/types";

type Move = {
  id: string;
  name: { en: string; zh: string };
  power: number;
  accuracy: number;
  effect?: "charge" | "heal" | "shield";
};

type Fighter = {
  name: { en: string; zh: string };
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  shield: number;
  moves: Move[];
};

const moveSet = {
  spark: { id: "spark", name: { en: "Spark Shot", zh: "电火花" }, power: 16, accuracy: 0.95, effect: "charge" as const },
  guard: { id: "guard", name: { en: "Mirror Guard", zh: "镜面守护" }, power: 0, accuracy: 1, effect: "shield" as const },
  burst: { id: "burst", name: { en: "Volt Burst", zh: "雷光爆发" }, power: 28, accuracy: 0.82 },
  bite: { id: "bite", name: { en: "Shadow Bite", zh: "暗影咬击" }, power: 15, accuracy: 0.96 },
  mend: { id: "mend", name: { en: "Moon Mend", zh: "月光治愈" }, power: 0, accuracy: 1, effect: "heal" as const },
  claw: { id: "claw", name: { en: "Night Claw", zh: "夜爪突袭" }, power: 24, accuracy: 0.86 },
};

const copy = {
  en: {
    eyebrow: "Pokemon-style mini demo",
    title: "Single-player 1v1 duel lab",
    body: "Take short turn-based battles, manage shield timing, and decide when to cash in your burst move.",
    back: "All games",
    reset: "Reset duel",
    yourSide: "Your side",
    enemySide: "Enemy side",
    currentRead: "Current read",
    battleLog: "Battle log",
    stable: "Stable board: chip safely and keep burst for a clean finish.",
    danger: "Danger state: respect the next hit and stabilize first.",
    pressure: "Pressure state: one strong sequence can close this duel.",
    win: "Victory. The enemy monster fainted.",
    lose: "Defeat. Your monster fainted.",
    turn: (value: number) => `Turn ${value}`,
    energy: "Energy",
    shield: "Shield",
    chooseMove: "Choose your move.",
    emptyLog: "The duel has started. Look for safe damage first.",
    used: (name: string, move: string, damage: number) => `${name} used ${move} and dealt ${damage}.`,
    missed: (name: string, move: string) => `${name}'s ${move} missed.`,
    healed: (name: string, amount: number) => `${name} recovered ${amount} HP.`,
    shielded: (name: string) => `${name} raised a shield for the next hit.`,
    utility: "Utility move",
  },
  zh: {
    eyebrow: "宝可梦风格小 Demo",
    title: "单机 1v1 回合对战",
    body: "用一个短局回合战测试护盾时机、消耗节奏和爆发收尾。",
    back: "全部游戏",
    reset: "重置对战",
    yourSide: "我方",
    enemySide: "敌方",
    currentRead: "当前判断",
    battleLog: "战斗记录",
    stable: "局势稳定：先稳健消耗，再找爆发收尾。",
    danger: "危险状态：先尊重下一次伤害，优先稳住血量。",
    pressure: "压制状态：下一套顺利连段就有机会结束战斗。",
    win: "胜利，敌方已经倒下。",
    lose: "失败，我方已经倒下。",
    turn: (value: number) => `第 ${value} 回合`,
    energy: "能量",
    shield: "护盾",
    chooseMove: "轮到你行动。",
    emptyLog: "对战开始，先找稳妥的消耗节奏。",
    used: (name: string, move: string, damage: number) => `${name} 使用 ${move}，造成 ${damage} 点伤害。`,
    missed: (name: string, move: string) => `${name} 的 ${move} 打空了。`,
    healed: (name: string, amount: number) => `${name} 回复了 ${amount} 点生命。`,
    shielded: (name: string) => `${name} 获得了下一次受击护盾。`,
    utility: "功能技能",
  },
} as const;

function createInitialState() {
  return {
    turn: 1,
    ended: false,
    player: {
      name: { en: "Voltfox", zh: "电狐" },
      hp: 100,
      maxHp: 100,
      energy: 2,
      maxEnergy: 5,
      shield: 0,
      moves: [moveSet.spark, moveSet.guard, moveSet.burst],
    } satisfies Fighter,
    enemy: {
      name: { en: "Shadefang", zh: "影牙" },
      hp: 96,
      maxHp: 96,
      energy: 2,
      maxEnergy: 5,
      shield: 0,
      moves: [moveSet.bite, moveSet.mend, moveSet.claw],
    } satisfies Fighter,
    log: [] as string[],
  };
}

function runMove(attacker: Fighter, defender: Fighter, move: Move, locale: Locale) {
  const t = copy[locale];
  const nextAttacker = { ...attacker };
  const nextDefender = { ...defender };
  const lines: string[] = [];

  if (Math.random() > move.accuracy) {
    lines.push(t.missed(attacker.name[locale], move.name[locale]));
    return { attacker: nextAttacker, defender: nextDefender, lines };
  }

  if (move.effect === "heal") {
    const amount = 18;
    nextAttacker.hp = Math.min(nextAttacker.maxHp, nextAttacker.hp + amount);
    lines.push(t.healed(attacker.name[locale], amount));
    return { attacker: nextAttacker, defender: nextDefender, lines };
  }

  if (move.effect === "shield") {
    nextAttacker.shield = 12;
    lines.push(t.shielded(attacker.name[locale]));
    return { attacker: nextAttacker, defender: nextDefender, lines };
  }

  let damage = move.power;
  if (move.effect === "charge") {
    nextAttacker.energy = Math.min(nextAttacker.maxEnergy, nextAttacker.energy + 1);
  }
  if (move.id === "burst" || move.id === "claw") {
    nextAttacker.energy = Math.max(0, nextAttacker.energy - 2);
  }
  if (nextDefender.shield > 0) {
    damage = Math.max(4, damage - nextDefender.shield);
    nextDefender.shield = 0;
  }
  nextDefender.hp = Math.max(0, nextDefender.hp - damage);
  lines.push(t.used(attacker.name[locale], move.name[locale], damage));
  return { attacker: nextAttacker, defender: nextDefender, lines };
}

function chooseEnemyMove(enemy: Fighter) {
  if (enemy.hp <= 26) {
    return enemy.moves[1];
  }
  if (enemy.energy >= 2) {
    return enemy.moves[2];
  }
  return enemy.moves[0];
}

export function PokemonDuelDemo({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, setState] = useState(createInitialState);
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
    if (state.ended && state.enemy.hp <= 0) {
      return t.win;
    }
    if (state.ended && state.player.hp <= 0) {
      return t.lose;
    }
    if (state.player.hp <= 30) {
      return t.danger;
    }
    if (state.enemy.hp <= 34 || state.player.energy >= 4) {
      return t.pressure;
    }
    return t.stable;
  }, [state, t]);

  function handleMove(move: Move) {
    if (state.ended) {
      return;
    }

    const playerTurn = runMove(state.player, state.enemy, move, locale);
    const midState = {
      ...state,
      player: playerTurn.attacker,
      enemy: playerTurn.defender,
      log: [...playerTurn.lines, ...state.log].slice(0, 8),
    };
    if (midState.enemy.hp <= 0) {
      setState({ ...midState, ended: true });
      return;
    }

    const enemyMove = chooseEnemyMove(midState.enemy);
    const enemyTurn = runMove(midState.enemy, midState.player, enemyMove, locale);
    setState({
      turn: state.turn + 1,
      ended: enemyTurn.defender.hp <= 0,
      player: enemyTurn.defender,
      enemy: enemyTurn.attacker,
      log: [...enemyTurn.lines, ...midState.log].slice(0, 8),
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(122,176,255,0.35),transparent_24%),linear-gradient(180deg,#f5f7ec_0%,#e8eef7_100%)] px-6 py-8 text-ink md:px-10">
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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.turn(state.turn)}</p>
              <p className="rounded-full bg-mist px-4 py-2 text-sm text-ink/70">{read}</p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[{ label: t.yourSide, fighter: state.player }, { label: t.enemySide, fighter: state.enemy }].map(({ label, fighter }) => (
                <article key={label} className="rounded-[1.6rem] bg-mist p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">{label}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{fighter.name[locale]}</h2>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-pine transition-all" style={{ width: `${(fighter.hp / fighter.maxHp) * 100}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-ink/68">HP {fighter.hp}/{fighter.maxHp}</p>
                  <p className="mt-1 text-sm text-ink/68">{t.energy} {fighter.energy}/{fighter.maxEnergy}</p>
                  <p className="mt-1 text-sm text-ink/68">{t.shield} {fighter.shield}</p>
                </article>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pine">{t.chooseMove}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {state.player.moves.map((move) => {
                  const disabled = state.ended || (move.id === "burst" && state.player.energy < 2);
                  return (
                    <button
                      key={move.id}
                      type="button"
                      onClick={() => handleMove(move)}
                      disabled={disabled}
                      className="rounded-[1.4rem] border border-ink/10 bg-white p-4 text-left disabled:opacity-45"
                    >
                      <p className="text-sm font-semibold text-ink">{move.name[locale]}</p>
                      <p className="mt-2 text-sm text-ink/62">{move.power > 0 ? `Power ${move.power}` : t.utility}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.currentRead}</p>
            <h2 className="mt-3 text-2xl font-semibold">{read}</h2>
            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.battleLog}</p>
              <div className="mt-4 space-y-3 text-sm text-white/78">
                {state.log.length === 0 ? <p>{t.emptyLog}</p> : state.log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
