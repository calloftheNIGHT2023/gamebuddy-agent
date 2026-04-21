"use client";

// MOBA 对线单机 demo，强调走位、技能释放、补刀和推进节奏。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/types";

type SkillKey = "q" | "w" | "e" | "r";

type SkillState = {
  name: { en: string; zh: string };
  cooldown: number;
  maxCooldown: number;
};

type LaneState = {
  minute: number;
  hp: number;
  mana: number;
  shield: number;
  gold: number;
  vision: number;
  position: number;
  enemyHp: number;
  enemyPosition: number;
  yourTower: number;
  enemyTower: number;
  minions: number;
  dragonReady: boolean;
  dragonStacks: number;
  enemyDragonStacks: number;
  enemyPressure: number;
  comboWindow: boolean;
  log: string[];
  ended: false | "win" | "lose";
  skills: Record<SkillKey, SkillState>;
};

const copy = {
  en: {
    eyebrow: "MOBA action demo",
    title: "Single-lane duel with skills",
    body: "Control spacing, cast abilities, last-hit waves, and choose when to pressure tower or rotate to dragon.",
    back: "All games",
    reset: "Reset match",
    controls: "Actions",
    currentRead: "Current read",
    battleLog: "Combat log",
    laneView: "Lane view",
    resources: "Resources",
    enemy: "Enemy duelist",
    you: "Your hero",
    minute: (value: number) => `Minute ${value}`,
    hp: "HP",
    mana: "Mana",
    shield: "Shield",
    gold: "Gold",
    vision: "Vision",
    towers: "Tower HP",
    dragons: (you: number, enemy: number) => `Dragon stacks ${you} - ${enemy}`,
    minions: (count: number) => `Wave minions ${count}`,
    distance: (value: number) => `Distance ${value}`,
    walkUp: "Step forward",
    kiteBack: "Step back",
    lastHit: "Last-hit wave",
    basicAttack: "Basic attack",
    q: "Q: Arc Bolt",
    w: "W: Guard Dash",
    e: "E: River Ward",
    r: "R: Breaker Dive",
    dragon: "Contest dragon",
    stable: "Even lane. Farm cleanly and look for short trades after cooldowns return.",
    danger: "You are under pressure. Back up, ward river, or reset before the enemy can dive.",
    pressure: "You have tempo. Convert it into tower damage or dragon control before the lane resets.",
    win: "Victory. You broke the lane and closed the game through tower pressure.",
    lose: "Defeat. The enemy forced you out of lane and your side collapsed.",
    cooldown: (value: number) => (value === 0 ? "Ready" : `CD ${value}`),
    dragonReady: "Dragon is spawning. Priority and vision matter now.",
    dragonDown: "Dragon is not up yet. Build wave control first.",
    enemyCast: "Enemy cast a quick combo and forced you to give ground.",
    enemyPoke: "Enemy landed a poke while holding wave priority.",
    enemyCrash: "Enemy crashed the wave into your tower.",
    walkUpLog: "You step up to contest space around the wave.",
    kiteBackLog: "You reset your spacing and deny the enemy an easy engage.",
    lastHitLog: "You secured the wave and pocketed clean gold.",
    missLastHitLog: "You reached late on the wave and lost control of several minions.",
    basicHitLog: "You walked into range and landed a basic attack.",
    basicMissLog: "You were too far away to connect a basic attack.",
    qHitLog: "Arc Bolt connected and chunked the enemy from range.",
    qMissLog: "Arc Bolt fizzled out because the enemy was too far away.",
    wLog: "Guard Dash gave you a shield and let you burst into trading range.",
    eLog: "You refreshed river control and lowered flank risk.",
    rHitLog: "Breaker Dive exploded through the lane and opened a kill window.",
    rMissLog: "Breaker Dive was forced early and failed to catch the enemy.",
    dragonLog: "You rotated first and converted your pressure into a dragon.",
    dragonFailLog: "You contested late and the enemy secured the dragon instead.",
    emptyLog: "The lane is quiet for now. Build an advantage before the next big fight.",
  },
  zh: {
    eyebrow: "MOBA 操作 Demo",
    title: "带技能的单线对局",
    body: "通过走位、技能释放、补刀和资源争夺，在一个轻量单机小局里打出对线节奏。",
    back: "全部游戏",
    reset: "重开对局",
    controls: "操作区",
    currentRead: "当前判断",
    battleLog: "对局记录",
    laneView: "兵线视图",
    resources: "资源状态",
    enemy: "敌方英雄",
    you: "你的英雄",
    minute: (value: number) => `第 ${value} 分钟`,
    hp: "生命",
    mana: "法力",
    shield: "护盾",
    gold: "金币",
    vision: "视野",
    towers: "防御塔血量",
    dragons: (you: number, enemy: number) => `小龙层数 ${you} - ${enemy}`,
    minions: (count: number) => `当前兵数 ${count}`,
    distance: (value: number) => `双方距离 ${value}`,
    walkUp: "前压一步",
    kiteBack: "后撤拉扯",
    lastHit: "补刀清线",
    basicAttack: "普攻消耗",
    q: "Q：奥术飞弹",
    w: "W：护盾冲步",
    e: "E：河道眼位",
    r: "R：破阵突进",
    dragon: "争夺小龙",
    stable: "局势均衡。稳住补刀，等技能转好后再找短换血。",
    danger: "你现在偏危险。先拉开、补视野或回合重置，别被强行越线。",
    pressure: "你已经拿到主动。优先把优势转成塔皮或小龙，而不是空打架。",
    win: "胜利。你靠对线压制推平了这一路。",
    lose: "失败。你被敌方滚起节奏，这条线已经失控。",
    cooldown: (value: number) => (value === 0 ? "就绪" : `冷却 ${value}`),
    dragonReady: "小龙已刷新，这波线权和视野很关键。",
    dragonDown: "小龙还没到时间，先把兵线和位置处理好。",
    enemyCast: "敌方打出一套小连招，逼你后撤。",
    enemyPoke: "敌方趁着线权完成了消耗。",
    enemyCrash: "敌方把兵线送进了你的塔下。",
    walkUpLog: "你向前压位，开始争兵线和身位。",
    kiteBackLog: "你主动后拉，避免被敌方抓到先手。",
    lastHitLog: "你顺利吃下兵线，经济稳稳到手。",
    missLastHitLog: "你处理兵线有些拖，漏了几只兵。",
    basicHitLog: "你卡到距离，用普攻点了对面一下。",
    basicMissLog: "你离得太远，这发普攻根本点不到。",
    qHitLog: "奥术飞弹命中，对面血量被明显压低。",
    qMissLog: "奥术飞弹放空了，距离没有卡准。",
    wLog: "你用护盾冲步顶上去，既能吃伤害也能贴脸。",
    eLog: "你补好了河道视野，敌方绕后和抓边的空间变小了。",
    rHitLog: "破阵突进直接打穿对线，敌方被你逼到崩盘边缘。",
    rMissLog: "这波大招开得太急，只打出了气势没打出收益。",
    dragonLog: "你抢先到位，顺势把小龙收入囊中。",
    dragonFailLog: "你到场太晚，小龙被敌方先拿走了。",
    emptyLog: "兵线已经上线，先靠操作把优势打出来。",
  },
} as const;

function createInitialState(): LaneState {
  return {
    minute: 5,
    hp: 100,
    mana: 90,
    shield: 0,
    gold: 520,
    vision: 38,
    position: 34,
    enemyHp: 100,
    enemyPosition: 68,
    yourTower: 100,
    enemyTower: 100,
    minions: 6,
    dragonReady: false,
    dragonStacks: 0,
    enemyDragonStacks: 0,
    enemyPressure: 45,
    comboWindow: false,
    log: [],
    ended: false,
    skills: {
      q: { name: { en: "Arc Bolt", zh: "奥术飞弹" }, cooldown: 0, maxCooldown: 2 },
      w: { name: { en: "Guard Dash", zh: "护盾冲步" }, cooldown: 0, maxCooldown: 3 },
      e: { name: { en: "River Ward", zh: "河道眼位" }, cooldown: 0, maxCooldown: 4 },
      r: { name: { en: "Breaker Dive", zh: "破阵突进" }, cooldown: 0, maxCooldown: 5 },
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tickCooldowns(skills: Record<SkillKey, SkillState>) {
  return {
    q: { ...skills.q, cooldown: Math.max(0, skills.q.cooldown - 1) },
    w: { ...skills.w, cooldown: Math.max(0, skills.w.cooldown - 1) },
    e: { ...skills.e, cooldown: Math.max(0, skills.e.cooldown - 1) },
    r: { ...skills.r, cooldown: Math.max(0, skills.r.cooldown - 1) },
  };
}

function pushLog(state: LaneState, message: string) {
  return [message, ...state.log].slice(0, 9);
}

function getDistance(state: LaneState) {
  return Math.max(0, Math.round(state.enemyPosition - state.position));
}

function resolveDamage(targetHp: number, shield: number, damage: number) {
  const absorbed = Math.min(shield, damage);
  return {
    hp: clamp(targetHp - (damage - absorbed), 0, 100),
    shield: Math.max(0, shield - damage),
  };
}

function applyEnemyTurn(state: LaneState, t: (typeof copy)[Locale]) {
  if (state.ended) {
    return state;
  }

  let next = {
    ...state,
    minute: state.minute + 1,
    mana: Math.min(100, state.mana + 8),
    minions: Math.max(3, Math.min(7, state.minions + 1)),
    dragonReady: state.minute + 1 >= 8,
    comboWindow: false,
    shield: Math.max(0, state.shield - 6),
  };

  const distance = getDistance(next);
  const enemyAhead = next.enemyPressure >= 58;

  if (distance <= 18 && enemyAhead) {
    const result = resolveDamage(next.hp, next.shield, 18);
    next = {
      ...next,
      hp: result.hp,
      shield: result.shield,
      position: clamp(next.position - 6, 8, 92),
      enemyPosition: clamp(next.enemyPosition + 2, 16, 94),
      enemyPressure: clamp(next.enemyPressure + 7, 0, 100),
      yourTower: clamp(next.yourTower - 6, 0, 100),
      log: pushLog(next, t.enemyCast),
    };
  } else if (distance <= 30) {
    const result = resolveDamage(next.hp, next.shield, 10);
    next = {
      ...next,
      hp: result.hp,
      shield: result.shield,
      enemyPressure: clamp(next.enemyPressure + 4, 0, 100),
      log: pushLog(next, t.enemyPoke),
    };
  } else {
    next = {
      ...next,
      yourTower: clamp(next.yourTower - 8, 0, 100),
      enemyPressure: clamp(next.enemyPressure + 6, 0, 100),
      enemyPosition: clamp(next.enemyPosition - 4, 16, 90),
      log: pushLog(next, t.enemyCrash),
    };
  }

  return next;
}

function finalizeState(state: LaneState) {
  if (state.enemyHp <= 0 || state.enemyTower <= 0 || state.dragonStacks >= 2) {
    return { ...state, enemyHp: Math.max(0, state.enemyHp), enemyTower: Math.max(0, state.enemyTower), ended: "win" as const };
  }

  if (state.hp <= 0 || state.yourTower <= 0 || state.enemyDragonStacks >= 2) {
    return { ...state, hp: Math.max(0, state.hp), yourTower: Math.max(0, state.yourTower), ended: "lose" as const };
  }

  return state;
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
    if (state.hp <= 35 || state.yourTower <= 35 || state.enemyPressure >= 72) {
      return t.danger;
    }
    if (state.enemyHp <= 42 || state.enemyTower <= 42 || state.dragonStacks > state.enemyDragonStacks) {
      return t.pressure;
    }
    return t.stable;
  }, [state, t]);

  const distance = getDistance(state);

  function commit(mutator: (current: LaneState) => LaneState) {
    setState((current) => {
      if (current.ended) {
        return current;
      }

      const acted = mutator(current);
      const enemyResolved = applyEnemyTurn(acted, t);
      const finalized = finalizeState(enemyResolved);
      return finalized;
    });
  }

  function spendSkill(current: LaneState, key: SkillKey) {
    return {
      ...current,
      skills: {
        ...current.skills,
        [key]: { ...current.skills[key], cooldown: current.skills[key].maxCooldown },
      },
    };
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(246,174,88,0.28),transparent_24%),linear-gradient(180deg,#f5f0e7_0%,#e4ecf4_100%)] px-6 py-8 text-ink md:px-10">
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

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] bg-white/86 p-6 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.laneView}</p>
              <span className="rounded-full bg-mist px-4 py-2 text-sm text-ink/70">{t.minute(state.minute)}</span>
            </div>

            <div className="mt-6 rounded-[1.6rem] bg-[#162332] px-5 py-6 text-white">
              <div className="mb-4 flex items-center justify-between text-sm text-white/72">
                <span>{t.you}</span>
                <span>{t.distance(distance)}</span>
                <span>{t.enemy}</span>
              </div>
              <div className="relative h-24 rounded-[1.2rem] bg-[linear-gradient(90deg,#22344a_0%,#2d5b3a_35%,#385b35_65%,#5a2f2f_100%)]">
                <div className="absolute left-5 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border-4 border-white bg-ember shadow-lg" style={{ left: `${state.position}%` }} />
                <div className="absolute top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border-4 border-white bg-pine shadow-lg" style={{ left: `${state.enemyPosition}%` }} />
                <div className="absolute left-2 top-2 rounded-full bg-white/12 px-3 py-1 text-xs text-white/82">{t.minions(state.minions)}</div>
                <div className="absolute bottom-2 left-2 rounded-full bg-white/12 px-3 py-1 text-xs text-white/82">
                  {state.dragonReady ? t.dragonReady : t.dragonDown}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.5rem] bg-mist p-5">
                <p className="text-sm text-ink/70">{t.resources}</p>
                <h2 className="mt-3 text-3xl font-semibold">{state.hp}</h2>
                <p className="mt-2 text-sm text-ink/70">{t.hp}</p>
                <p className="mt-3 text-sm text-ink/70">{t.mana} {state.mana}</p>
                <p className="mt-2 text-sm text-ink/70">{t.shield} {state.shield}</p>
                <p className="mt-2 text-sm text-ink/70">{t.gold} {state.gold}</p>
                <p className="mt-2 text-sm text-ink/70">{t.vision} {state.vision}</p>
              </article>
              <article className="rounded-[1.5rem] bg-mist p-5">
                <p className="text-sm text-ink/70">{t.enemy}</p>
                <h2 className="mt-3 text-3xl font-semibold">{state.enemyHp}</h2>
                <p className="mt-2 text-sm text-ink/70">{t.hp}</p>
                <p className="mt-3 text-sm text-ink/70">{t.towers} {state.yourTower} / {state.enemyTower}</p>
                <p className="mt-2 text-sm text-ink/70">{t.dragons(state.dragonStacks, state.enemyDragonStacks)}</p>
              </article>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  commit((current) => ({
                    ...current,
                    position: clamp(current.position + 8, 10, 78),
                    enemyPosition: clamp(current.enemyPosition - 2, 22, 92),
                    enemyPressure: clamp(current.enemyPressure - 2, 0, 100),
                    skills: tickCooldowns(current.skills),
                    log: pushLog(current, t.walkUpLog),
                  }))
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold">{t.walkUp}</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  commit((current) => ({
                    ...current,
                    position: clamp(current.position - 8, 6, 78),
                    mana: Math.min(100, current.mana + 4),
                    enemyPressure: clamp(current.enemyPressure - 8, 0, 100),
                    skills: tickCooldowns(current.skills),
                    log: pushLog(current, t.kiteBackLog),
                  }))
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold">{t.kiteBack}</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  commit((current) => {
                    const cleanFarm = current.position >= 24 && current.position <= 52;
                    return {
                      ...current,
                      gold: current.gold + (cleanFarm ? 125 : 70),
                      minions: Math.max(0, current.minions - (cleanFarm ? 4 : 2)),
                      enemyPressure: clamp(current.enemyPressure + (cleanFarm ? 1 : 5), 0, 100),
                      skills: tickCooldowns(current.skills),
                      log: pushLog(current, cleanFarm ? t.lastHitLog : t.missLastHitLog),
                    };
                  })
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold">{t.lastHit}</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  commit((current) => {
                    const hit = getDistance(current) <= 16;
                    return {
                      ...current,
                      enemyHp: clamp(current.enemyHp - (hit ? 11 : 0), 0, 100),
                      enemyPressure: clamp(current.enemyPressure + (hit ? -6 : 4), 0, 100),
                      enemyTower: clamp(current.enemyTower - (hit && current.enemyHp <= 0 ? 15 : 0), 0, 100),
                      skills: tickCooldowns(current.skills),
                      log: pushLog(current, hit ? t.basicHitLog : t.basicMissLog),
                    };
                  })
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold">{t.basicAttack}</p>
              </button>

              <button
                type="button"
                disabled={state.mana < 14 || state.skills.q.cooldown > 0}
                onClick={() =>
                  commit((current) => {
                    const hit = getDistance(current) <= 28;
                    return spendSkill(
                      {
                        ...current,
                        mana: current.mana - 14,
                        enemyHp: clamp(current.enemyHp - (hit ? 18 : 0), 0, 100),
                        enemyPressure: clamp(current.enemyPressure + (hit ? -7 : 3), 0, 100),
                        skills: tickCooldowns(current.skills),
                        log: pushLog(current, hit ? t.qHitLog : t.qMissLog),
                      },
                      "q",
                    );
                  })
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left disabled:opacity-45"
              >
                <p className="text-lg font-semibold">{t.q}</p>
                <p className="mt-2 text-xs text-ink/60">{t.cooldown(state.skills.q.cooldown)}</p>
              </button>

              <button
                type="button"
                disabled={state.mana < 18 || state.skills.w.cooldown > 0}
                onClick={() =>
                  commit((current) =>
                    spendSkill(
                      {
                        ...current,
                        mana: current.mana - 18,
                        shield: clamp(current.shield + 18, 0, 40),
                        position: clamp(current.position + 10, 10, 84),
                        enemyPressure: clamp(current.enemyPressure - 5, 0, 100),
                        comboWindow: true,
                        skills: tickCooldowns(current.skills),
                        log: pushLog(current, t.wLog),
                      },
                      "w",
                    ),
                  )
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left disabled:opacity-45"
              >
                <p className="text-lg font-semibold">{t.w}</p>
                <p className="mt-2 text-xs text-ink/60">{t.cooldown(state.skills.w.cooldown)}</p>
              </button>

              <button
                type="button"
                disabled={state.mana < 10 || state.skills.e.cooldown > 0}
                onClick={() =>
                  commit((current) =>
                    spendSkill(
                      {
                        ...current,
                        mana: current.mana - 10,
                        vision: clamp(current.vision + 28, 0, 100),
                        enemyPressure: clamp(current.enemyPressure - 8, 0, 100),
                        skills: tickCooldowns(current.skills),
                        log: pushLog(current, t.eLog),
                      },
                      "e",
                    ),
                  )
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left disabled:opacity-45"
              >
                <p className="text-lg font-semibold">{t.e}</p>
                <p className="mt-2 text-xs text-ink/60">{t.cooldown(state.skills.e.cooldown)}</p>
              </button>

              <button
                type="button"
                disabled={state.mana < 28 || state.skills.r.cooldown > 0}
                onClick={() =>
                  commit((current) => {
                    const hit = getDistance(current) <= 24 || current.comboWindow;
                    return spendSkill(
                      {
                        ...current,
                        mana: current.mana - 28,
                        enemyHp: clamp(current.enemyHp - (hit ? 34 : 10), 0, 100),
                        enemyTower: clamp(current.enemyTower - (hit ? 12 : 0), 0, 100),
                        position: clamp(current.position + 8, 10, 86),
                        enemyPosition: clamp(current.enemyPosition + (hit ? 6 : 2), 18, 95),
                        enemyPressure: clamp(current.enemyPressure - (hit ? 16 : 3), 0, 100),
                        skills: tickCooldowns(current.skills),
                        log: pushLog(current, hit ? t.rHitLog : t.rMissLog),
                      },
                      "r",
                    );
                  })
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left disabled:opacity-45 md:col-span-2"
              >
                <p className="text-lg font-semibold">{t.r}</p>
                <p className="mt-2 text-xs text-ink/60">{t.cooldown(state.skills.r.cooldown)}</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  commit((current) => {
                    const success = current.dragonReady && current.vision >= 55 && current.hp >= 48;
                    return {
                      ...current,
                      hp: clamp(current.hp - (success ? 10 : 18), 0, 100),
                      dragonStacks: current.dragonStacks + (success ? 1 : 0),
                      enemyDragonStacks: current.enemyDragonStacks + (success ? 0 : 1),
                      enemyPressure: clamp(current.enemyPressure - (success ? 12 : -6), 0, 100),
                      skills: tickCooldowns(current.skills),
                      log: pushLog(current, success ? t.dragonLog : t.dragonFailLog),
                    };
                  })
                }
                className="rounded-[1.35rem] border border-ink/10 bg-white p-4 text-left md:col-span-2"
              >
                <p className="text-lg font-semibold">{t.dragon}</p>
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.currentRead}</p>
              <h2 className="mt-3 text-2xl font-semibold">{read}</h2>
              <p className="mt-4 text-sm text-white/75">{t.dragons(state.dragonStacks, state.enemyDragonStacks)}</p>
            </div>

            <div className="rounded-[2rem] bg-white/86 p-6 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.battleLog}</p>
              <div className="mt-4 space-y-3 text-sm text-ink/72">
                {state.log.length === 0 ? <p>{t.emptyLog}</p> : state.log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
