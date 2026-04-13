"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/types";

type Vec = { x: number; y: number };
type Enemy = Vec & { id: number; hp: number; speed: number; radius: number; touchCooldown: number };
type Projectile = Vec & { id: number; vx: number; vy: number; damage: number; radius: number; life: number };
type Gem = Vec & { id: number; value: number };
type UpgradeKey = "fireRate" | "damage" | "speed" | "magnet" | "maxHp";
type Upgrade = { key: UpgradeKey; title: Record<Locale, string>; description: Record<Locale, string> };

type GameState = {
  player: Vec;
  hp: number;
  maxHp: number;
  speed: number;
  fireRate: number;
  damage: number;
  magnet: number;
  projectiles: Projectile[];
  enemies: Enemy[];
  gems: Gem[];
  timeMs: number;
  kills: number;
  score: number;
  xp: number;
  level: number;
  nextEnemyId: number;
  nextProjectileId: number;
  nextGemId: number;
  spawnTimer: number;
  shootTimer: number;
  running: boolean;
  gameOver: boolean;
  pendingLevelUps: number;
};

const arena = { width: 880, height: 560 };

const ui = {
  en: {
    eyebrow: "Arcade Survival",
    title: "Mini survivor mode.",
    subtitle: "Auto fire, manual movement, softer early pressure. Move with WASD or arrow keys and choose one upgrade on level up.",
    restart: "Restart",
    allGames: "All games",
    time: "Time",
    level: "Level",
    kills: "Kills",
    score: "Score",
    best: "Best",
    hp: "HP",
    xp: "XP",
    levelUp: "Level up",
    pickOne: "Pick one upgrade.",
    runOver: "Run over",
    swarmed: "You got swarmed.",
    survived: (timeText: string, score: number, kills: number) => `Survived ${timeText} · Score ${score} · Kills ${kills}`,
    tryAgain: "Try again",
    prediction: "AI prediction",
    phase: "Current phase",
    bestDirection: "Best direction",
    avoidLine: "Avoid this line",
    controls: "Controls",
    controlsList: [
      "WASD / Arrow keys: move",
      "The hero automatically fires at the nearest enemy.",
      "Collect XP gems to level up and pause for a one-of-three upgrade choice.",
      "Press Space after defeat to restart quickly.",
    ],
    build: "Build",
    fireInterval: "Fire interval",
    damage: "Damage",
    moveSpeed: "Move speed",
    pickupRadius: "Pickup radius",
    maxHp: "Max HP",
    designNote: "Design note",
    designBody: "This version is intentionally easier: slower waves, lower contact damage, better starting stats, and a clearer early build curve.",
  },
  zh: {
    eyebrow: "街机生存模式",
    title: "迷你生存原型。",
    subtitle: "自动攻击，手动走位，前期压力更低。用 WASD 或方向键移动，升级时三选一强化。",
    restart: "重新开始",
    allGames: "全部游戏",
    time: "时间",
    level: "等级",
    kills: "击杀",
    score: "分数",
    best: "最高分",
    hp: "生命",
    xp: "经验",
    levelUp: "升级",
    pickOne: "选择一个强化。",
    runOver: "本轮结束",
    swarmed: "你被怪潮淹没了。",
    survived: (timeText: string, score: number, kills: number) => `存活 ${timeText} · 分数 ${score} · 击杀 ${kills}`,
    tryAgain: "再来一局",
    prediction: "AI 预测",
    phase: "当前阶段",
    bestDirection: "最佳方向",
    avoidLine: "不推荐路线",
    controls: "操作说明",
    controlsList: [
      "WASD / 方向键：移动",
      "角色会自动朝最近的敌人发射弹丸。",
      "吸收经验球后会升级，并暂停出现三选一强化。",
      "失败后按空格可以快速重开。",
    ],
    build: "当前构筑",
    fireInterval: "射击间隔",
    damage: "伤害",
    moveSpeed: "移动速度",
    pickupRadius: "拾取范围",
    maxHp: "最大生命",
    designNote: "设计说明",
    designBody: "这一版已经调低难度：刷怪更慢、碰撞伤害更低、初始属性更好，前期成长也更顺。",
  },
} as const;

const upgrades: Upgrade[] = [
  { key: "fireRate", title: { en: "Rapid Wand", zh: "疾速魔杖" }, description: { en: "Projectiles fire faster.", zh: "弹丸发射得更快。" } },
  { key: "damage", title: { en: "Heavy Bolts", zh: "重型弹丸" }, description: { en: "Each shot hits harder.", zh: "每次攻击伤害更高。" } },
  { key: "speed", title: { en: "Swift Boots", zh: "疾行靴" }, description: { en: "Move speed increases.", zh: "提高移动速度。" } },
  { key: "magnet", title: { en: "Soul Magnet", zh: "灵魂磁石" }, description: { en: "Pick up gems from farther away.", zh: "更远距离吸附经验球。" } },
  { key: "maxHp", title: { en: "Blood Flask", zh: "鲜血药瓶" }, description: { en: "Increase max HP and heal a little.", zh: "提高最大生命并恢复少量血量。" } },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function xpToNextLevel(level: number) {
  return 5 + (level - 1) * 3;
}

function initialState(): GameState {
  return {
    player: { x: arena.width / 2, y: arena.height / 2 },
    hp: 120,
    maxHp: 120,
    speed: 235,
    fireRate: 0.5,
    damage: 18,
    magnet: 64,
    projectiles: [],
    enemies: [],
    gems: [],
    timeMs: 0,
    kills: 0,
    score: 0,
    xp: 0,
    level: 1,
    nextEnemyId: 1,
    nextProjectileId: 1,
    nextGemId: 1,
    spawnTimer: 900,
    shootTimer: 180,
    running: true,
    gameOver: false,
    pendingLevelUps: 0,
  };
}

function spawnEnemy(id: number, elapsedMs: number): Enemy {
  const edge = Math.floor(Math.random() * 4);
  const padding = 20;
  const speed = 42 + Math.min(88, elapsedMs / 2600);
  const hp = 16 + elapsedMs / 8500;
  if (edge === 0) return { id, x: Math.random() * arena.width, y: -padding, hp, speed, radius: 14, touchCooldown: 0 };
  if (edge === 1) return { id, x: arena.width + padding, y: Math.random() * arena.height, hp, speed, radius: 14, touchCooldown: 0 };
  if (edge === 2) return { id, x: Math.random() * arena.width, y: arena.height + padding, hp, speed, radius: 14, touchCooldown: 0 };
  return { id, x: -padding, y: Math.random() * arena.height, hp, speed, radius: 14, touchCooldown: 0 };
}

function pickUpgrades(level: number) {
  const offset = (level - 2) % upgrades.length;
  return [0, 1, 2].map((index) => upgrades[(offset + index) % upgrades.length]);
}

export function SurvivorSandbox({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [game, setGame] = useState<GameState>(initialState);
  const [highScore, setHighScore] = useState(0);
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});
  const [isMounted, setIsMounted] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const t = ui[locale];
  const choices = useMemo(() => pickUpgrades(game.level), [game.level]);

  useEffect(() => {
    setIsMounted(true);
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (storedLocale === "en" || storedLocale === "zh") setLocale(storedLocale);
    const rawScore = window.localStorage.getItem("gamebuddy:survivor-high-score");
    if (rawScore) {
      const parsed = Number(rawScore);
      if (!Number.isNaN(parsed)) setHighScore(parsed);
    }
  }, []);

  useEffect(() => {
    function onKeyChange(event: KeyboardEvent, pressed: boolean) {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        setActiveKeys((current) => ({ ...current, [key]: pressed }));
      }
      if (key === " " && pressed && (game.gameOver || !game.running)) setGame(initialState());
    }
    const onKeyDown = (event: KeyboardEvent) => onKeyChange(event, true);
    const onKeyUp = (event: KeyboardEvent) => onKeyChange(event, false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [game.gameOver, game.running]);

  useEffect(() => {
    if (!isMounted) return;
    function tick(now: number) {
      if (lastTickRef.current === null) lastTickRef.current = now;
      const deltaMs = Math.min(40, now - lastTickRef.current);
      lastTickRef.current = now;

      setGame((current) => {
        if (!current.running || current.gameOver) return current;
        const dt = deltaMs / 1000;
        const horizontal = (activeKeys.d || activeKeys.arrowright ? 1 : 0) - (activeKeys.a || activeKeys.arrowleft ? 1 : 0);
        const vertical = (activeKeys.s || activeKeys.arrowdown ? 1 : 0) - (activeKeys.w || activeKeys.arrowup ? 1 : 0);
        const length = Math.hypot(horizontal, vertical) || 1;
        const player = {
          x: clamp(current.player.x + (horizontal === 0 ? 0 : (horizontal / length) * current.speed * dt), 18, arena.width - 18),
          y: clamp(current.player.y + (vertical === 0 ? 0 : (vertical / length) * current.speed * dt), 18, arena.height - 18),
        };

        let { nextEnemyId, nextProjectileId, nextGemId, hp, kills, score, xp, level, pendingLevelUps } = current;
        let spawnTimer = current.spawnTimer - deltaMs;
        let shootTimer = current.shootTimer - deltaMs;
        const enemies = [...current.enemies];
        const projectiles = [...current.projectiles];
        const gems = [...current.gems];

        while (spawnTimer <= 0) {
          enemies.push(spawnEnemy(nextEnemyId, current.timeMs));
          nextEnemyId += 1;
          spawnTimer += Math.max(420, 1100 - current.timeMs / 38);
        }

        const target = enemies.reduce<Enemy | null>((closest, enemy) => (!closest || distance(enemy, player) < distance(closest, player) ? enemy : closest), null);

        while (target && shootTimer <= 0) {
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const magnitude = Math.hypot(dx, dy) || 1;
          projectiles.push({
            id: nextProjectileId,
            x: player.x,
            y: player.y,
            vx: (dx / magnitude) * 420,
            vy: (dy / magnitude) * 420,
            damage: current.damage,
            radius: 7 + current.level * 0.15,
            life: 1.2,
          });
          nextProjectileId += 1;
          shootTimer += current.fireRate * 1000;
        }

        const movedProjectiles = projectiles
          .map((projectile) => ({ ...projectile, x: projectile.x + projectile.vx * dt, y: projectile.y + projectile.vy * dt, life: projectile.life - dt }))
          .filter((projectile) => projectile.life > 0 && projectile.x > -30 && projectile.x < arena.width + 30 && projectile.y > -30 && projectile.y < arena.height + 30);

        const movedEnemies = enemies.map((enemy) => {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const magnitude = Math.hypot(dx, dy) || 1;
          return { ...enemy, x: enemy.x + (dx / magnitude) * enemy.speed * dt, y: enemy.y + (dy / magnitude) * enemy.speed * dt, touchCooldown: Math.max(0, enemy.touchCooldown - dt) };
        });

        const remainingProjectiles: Projectile[] = [];
        const survivingEnemies: Enemy[] = [];

        movedProjectiles.forEach((projectile) => {
          let consumed = false;
          for (const enemy of movedEnemies) {
            if (consumed || enemy.hp <= 0) continue;
            if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
              enemy.hp -= projectile.damage;
              consumed = true;
            }
          }
          if (!consumed) remainingProjectiles.push(projectile);
        });

        movedEnemies.forEach((enemy) => {
          if (enemy.hp <= 0) {
            kills += 1;
            score += 12;
            gems.push({ id: nextGemId, x: enemy.x, y: enemy.y, value: 1 });
            nextGemId += 1;
            return;
          }
          if (distance(enemy, player) <= enemy.radius + 14 && enemy.touchCooldown <= 0) {
            hp = Math.max(0, hp - 9);
            enemy.touchCooldown = 0.65;
          }
          survivingEnemies.push(enemy);
        });

        const remainingGems = gems.filter((gem) => {
          if (distance(gem, player) <= current.magnet) {
            xp += gem.value;
            score += 4;
            return false;
          }
          return true;
        });

        while (xp >= xpToNextLevel(level)) {
          xp -= xpToNextLevel(level);
          level += 1;
          pendingLevelUps += 1;
        }

        const gameOver = hp <= 0;
        const running = !gameOver && pendingLevelUps === 0;
        const nextState = { ...current, player, hp, projectiles: remainingProjectiles, enemies: survivingEnemies, gems: remainingGems, timeMs: current.timeMs + deltaMs, kills, score, xp, level, nextEnemyId, nextProjectileId, nextGemId, spawnTimer, shootTimer, running, gameOver, pendingLevelUps };
        if (gameOver && score > highScore) {
          setHighScore(score);
          window.localStorage.setItem("gamebuddy:survivor-high-score", String(score));
        }
        return nextState;
      });

      frameRef.current = window.requestAnimationFrame(tick);
    }

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastTickRef.current = null;
    };
  }, [activeKeys, highScore, isMounted]);

  function applyUpgrade(choice: UpgradeKey) {
    setGame((current) => {
      if (current.pendingLevelUps <= 0) return current;
      const next = { ...current, pendingLevelUps: current.pendingLevelUps - 1 };
      if (choice === "fireRate") next.fireRate = Math.max(0.18, current.fireRate * 0.84);
      if (choice === "damage") next.damage = current.damage + 6;
      if (choice === "speed") next.speed = current.speed + 20;
      if (choice === "magnet") next.magnet = current.magnet + 18;
      if (choice === "maxHp") {
        next.maxHp = current.maxHp + 18;
        next.hp = Math.min(next.maxHp, current.hp + 26);
      }
      next.running = next.pendingLevelUps === 0 && !next.gameOver;
      return next;
    });
  }

  const hpRatio = Math.max(0, game.hp / game.maxHp);
  const xpRatio = game.xp / xpToNextLevel(game.level);
  const timeText = `${Math.floor(game.timeMs / 60000).toString().padStart(2, "0")}:${Math.floor((game.timeMs % 60000) / 1000).toString().padStart(2, "0")}`;
  const prediction = useMemo(() => {
    const pressure = game.enemies.length;
    if (game.hp <= game.maxHp * 0.35 && pressure >= 10) {
      return {
        phase: locale === "zh" ? "高压脱身阶段" : "High-pressure survival phase",
        best: locale === "zh" ? "优先拉开距离，绕大圈吸经验，不要为了单个经验球硬吃包围。" : "Create space first, kite in wide circles, and collect safe XP instead of forcing one risky pickup.",
        avoid: locale === "zh" ? "不要停在怪堆边缘硬换血。" : "Do not stand near the pack edge and trade HP for small gains.",
      };
    }
    if (game.pendingLevelUps > 0 || game.level <= 3) {
      return {
        phase: locale === "zh" ? "开局成型阶段" : "Early build-forming phase",
        best: locale === "zh" ? "先拿稳定成长词条，优先射速、伤害和拾取范围。" : "Take stable scaling first, especially fire rate, damage, and pickup radius.",
        avoid: locale === "zh" ? "不要过早只堆单一生存属性。" : "Do not overcommit to pure survivability too early.",
      };
    }
    if (pressure <= 6 && game.hp >= game.maxHp * 0.7) {
      return {
        phase: locale === "zh" ? "滚雪球阶段" : "Snowball phase",
        best: locale === "zh" ? "主动清近身怪并扩大经验控制，尽快多升一级。" : "Clear nearby enemies aggressively and convert the safe board into faster leveling.",
        avoid: locale === "zh" ? "不要无意义绕远，浪费这段安全时间。" : "Do not waste the safe window by drifting without collecting XP.",
      };
    }
    return {
      phase: locale === "zh" ? "中盘控场阶段" : "Mid-run control phase",
      best: locale === "zh" ? "保持移动节奏，把怪拉成一团后从侧边削薄。" : "Keep moving rhythmically, stack the pack together, and thin it from the side.",
      avoid: locale === "zh" ? "不要直线冲进最密集的位置。" : "Do not run straight into the densest center of the pack.",
    };
  }, [game.enemies.length, game.hp, game.level, game.maxHp, game.pendingLevelUps, locale]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,180,92,0.22),transparent_24%),linear-gradient(180deg,#17191f_0%,#0f1116_100%)] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-orange-300">{t.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">{t.title}</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/70 md:text-base">{t.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <LocaleSwitcher locale={locale} label={locale === "zh" ? "语言" : "Language"} />
            <button type="button" onClick={() => setGame(initialState())} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-card">
              {t.restart}
            </button>
            <Link href={`/play?lang=${locale}`} className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white">
              {t.allGames}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-card backdrop-blur">
            <div className="mb-4 grid gap-3 md:grid-cols-5">
              <StatCard label={t.time} value={timeText} />
              <StatCard label={t.level} value={String(game.level)} />
              <StatCard label={t.kills} value={String(game.kills)} />
              <StatCard label={t.score} value={String(game.score)} />
              <StatCard label={t.best} value={String(highScore)} />
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <BarCard label={t.hp} ratio={hpRatio} value={`${Math.max(0, Math.ceil(game.hp))}/${game.maxHp}`} tone="bg-rose-400" />
              <BarCard label={t.xp} ratio={xpRatio} value={`${game.xp}/${xpToNextLevel(game.level)}`} tone="bg-amber-300" />
            </div>
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(78,93,61,0.3),transparent_55%),linear-gradient(180deg,#1d2320_0%,#141815_100%)]" style={{ aspectRatio: `${arena.width} / ${arena.height}` }}>
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px]" />
              {game.gems.map((gem) => <div key={gem.id} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.7)]" style={{ left: `${(gem.x / arena.width) * 100}%`, top: `${(gem.y / arena.height) * 100}%` }} />)}
              {game.projectiles.map((projectile) => <div key={projectile.id} className="absolute rounded-full bg-amber-100 shadow-[0_0_22px_rgba(253,230,138,0.9)]" style={{ left: `${(projectile.x / arena.width) * 100}%`, top: `${(projectile.y / arena.height) * 100}%`, width: `${projectile.radius * 2}px`, height: `${projectile.radius * 2}px`, transform: "translate(-50%, -50%)" }} />)}
              {game.enemies.map((enemy) => <div key={enemy.id} className="absolute rounded-full border border-rose-200/30 bg-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.45)]" style={{ left: `${(enemy.x / arena.width) * 100}%`, top: `${(enemy.y / arena.height) * 100}%`, width: `${enemy.radius * 2}px`, height: `${enemy.radius * 2}px`, transform: "translate(-50%, -50%)" }} />)}
              <div className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-100 bg-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.8)]" style={{ left: `${(game.player.x / arena.width) * 100}%`, top: `${(game.player.y / arena.height) * 100}%` }} />

              {!game.gameOver && game.pendingLevelUps > 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/72 p-4">
                  <div className="w-full max-w-2xl rounded-[1.8rem] border border-amber-300/30 bg-slate-900/95 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">{t.levelUp}</p>
                    <h2 className="mt-2 text-2xl font-semibold">{t.pickOne}</h2>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {choices.map((choice) => (
                        <button key={choice.key} type="button" onClick={() => applyUpgrade(choice.key)} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-300/50 hover:bg-white/10">
                          <p className="text-base font-semibold">{choice.title[locale]}</p>
                          <p className="mt-2 text-sm text-white/68">{choice.description[locale]}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {game.gameOver ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 p-4">
                  <div className="w-full max-w-md rounded-[1.8rem] border border-rose-300/25 bg-slate-900/95 p-6 text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-300">{t.runOver}</p>
                    <h2 className="mt-2 text-3xl font-semibold">{t.swarmed}</h2>
                    <p className="mt-3 text-sm text-white/72">{t.survived(timeText, game.score, game.kills)}</p>
                    <button type="button" onClick={() => setGame(initialState())} className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                      {t.tryAgain}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">{t.prediction}</p>
              <div className="mt-4 space-y-4 text-sm text-white/75">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{t.phase}</p>
                  <p className="mt-1 text-base text-white">{prediction.phase}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{t.bestDirection}</p>
                  <p className="mt-1">{prediction.best}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">{t.avoidLine}</p>
                  <p className="mt-1">{prediction.avoid}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">{t.controls}</p>
              <div className="mt-4 space-y-3 text-sm text-white/72">
                {t.controlsList.map((line) => <p key={line}>{line}</p>)}
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">{t.build}</p>
              <div className="mt-4 grid gap-3 text-sm text-white/75">
                <MiniRow label={t.fireInterval} value={`${game.fireRate.toFixed(2)}s`} />
                <MiniRow label={t.damage} value={String(game.damage)} />
                <MiniRow label={t.moveSpeed} value={String(Math.round(game.speed))} />
                <MiniRow label={t.pickupRadius} value={String(Math.round(game.magnet))} />
                <MiniRow label={t.maxHp} value={String(game.maxHp)} />
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-300/15 to-rose-300/10 p-5 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200">{t.designNote}</p>
              <p className="mt-3 text-sm text-white/72">{t.designBody}</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>;
}

function BarCard({ label, ratio, value, tone }: { label: string; ratio: number; value: string; tone: string }) {
  return <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{label}</p><p className="text-sm text-white/80">{value}</p></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${tone}`} style={{ width: `${clamp(ratio, 0, 1) * 100}%` }} /></div></div>;
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-[1rem] border border-white/8 bg-black/10 px-4 py-3"><span>{label}</span><span className="font-semibold text-white">{value}</span></div>;
}
