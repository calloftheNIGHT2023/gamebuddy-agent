"use client";

// 生存沙盒 demo，通过定时循环模拟走位、掉落和升级节奏。
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
type Prediction = { phase: string; best: string; avoid: string };

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

function pickVariant<T>(items: T[], seed: number) {
  return items[Math.abs(seed) % items.length];
}

function buildPrediction(game: GameState, locale: Locale): Prediction {
  const hpRatio = game.maxHp > 0 ? game.hp / game.maxHp : 0;
  const pressure = game.enemies.length;
  const nearEnemies = game.enemies.filter((enemy) => distance(enemy, game.player) <= 110).length;
  const nearbyGems = game.gems.filter((gem) => distance(gem, game.player) <= game.magnet * 1.8).length;
  const xpRatio = game.xp / xpToNextLevel(game.level);
  const buildPower = game.damage + (0.6 / game.fireRate) * 10 + game.speed * 0.05 + game.magnet * 0.03;
  const buildLean =
    game.damage >= 32 || game.fireRate <= 0.3
      ? "offense"
      : game.maxHp >= 150 || game.speed >= 285
        ? "survival"
        : "economy";
  const seed = game.level + game.kills + Math.floor(game.timeMs / 5000) + pressure;

  if (game.pendingLevelUps > 0) {
    return locale === "zh"
      ? {
          phase: "升级抉择窗口",
          best: pickVariant([
            "这一拍先补能立刻改变节奏的词条。火力偏弱时优先射速或伤害，经验难吃时优先拾取范围。",
            "别把升级当成单纯加数值，先补当前最限制跑图效率的短板，再考虑贪后期成长。",
            "如果场上压力刚上来，这次升级先选能马上稳住局面的强化，而不是最慢热的方案。",
          ], seed),
          avoid: pickVariant([
            "不要在已经缺输出的时候继续堆纯血量。",
            "不要只看面板好看，忽略现在最影响走位和清怪的瓶颈。",
            "不要每次都选同一类强化，失衡 build 会在中盘开始卡节奏。",
          ], seed + 1),
        }
      : {
          phase: "Level-up decision window",
          best: pickVariant([
            "Use this pause to fix the stat that changes board control immediately. Take fire rate or damage if kills are slow, and magnet if XP is slipping away.",
            "Treat this as a tempo choice, not just a number upgrade. Patch the stat that is currently limiting your movement and clear speed.",
            "If the wave has just started tightening, take the upgrade that stabilizes the next thirty seconds instead of the slowest scaling option.",
          ], seed),
          avoid: pickVariant([
            "Do not keep stacking pure HP when your real problem is weak damage.",
            "Do not pick the prettiest stat line if it leaves your current bottleneck untouched.",
            "Do not tunnel on one upgrade family every level; the run gets awkward once the build loses balance.",
          ], seed + 1),
        };
  }

  if (hpRatio <= 0.3 && (pressure >= 10 || nearEnemies >= 4)) {
    return locale === "zh"
      ? {
          phase: "高压脱身阶段",
          best: pickVariant([
            "先保命，不要急着吃远处经验。沿外圈拉开怪群，把最近的一侧削薄后再回收资源。",
            "你的首要任务是制造空白区。先横向拉扯，再顺着已经清开的方向接经验球。",
            "这一段应该主动放慢贪刀节奏，用更大的绕圈半径换安全距离。",
          ], seed),
          avoid: pickVariant([
            "不要贴着怪群边缘硬换血。",
            "不要为了单颗经验球直接折返冲进包围圈。",
            "不要在被多面夹击时走直线，直线最容易被封头。",
          ], seed + 1),
        }
      : {
          phase: "High-pressure escape phase",
          best: pickVariant([
            "Play for survival first. Skip the far gems, drag the pack wide, and only re-enter through the thinnest side.",
            "Your job here is to create blank space. Strafe sideways, open one lane, then reclaim XP through the safe corridor.",
            "Slow down the greed for a few seconds and trade a wider kite radius for cleaner breathing room.",
          ], seed),
          avoid: pickVariant([
            "Do not hug the pack edge and trade HP.",
            "Do not turn back into the swarm for a single gem.",
            "Do not sprint in straight lines when enemies are collapsing from multiple angles.",
          ], seed + 1),
        };
  }

  if (game.level <= 3 || game.timeMs < 45000) {
    return locale === "zh"
      ? {
          phase: "开局成型阶段",
          best: pickVariant([
            "这一段重点是把 build 先立起来。优先保证清怪节奏，其次再补跑图舒适度。",
            "开局别急着赌后期，先把射速、伤害和拾取效率做成一个顺手的底盘。",
            "现在更像铺路期，能让你稳定升到下一两级的强化价值最高。",
          ], seed),
          avoid: pickVariant([
            "不要太早把点数全压在单一生存属性上。",
            "不要为了追怪偏离经验密集区太远。",
            "不要让升级选择变成随机乱拿，前几级最需要连贯思路。",
          ], seed + 1),
        }
      : {
          phase: "Early build-forming phase",
          best: pickVariant([
            "The goal here is to establish a usable build shell. Secure clear speed first, then smooth out movement and pickup comfort.",
            "Do not gamble on late-game fantasies yet. Build a reliable base with fire rate, damage, and XP collection efficiency.",
            "This is still a setup period, so upgrades that reliably get you through the next couple of levels are worth the most.",
          ], seed),
          avoid: pickVariant([
            "Do not dump early levels into one survival stat and call it a build.",
            "Do not chase enemies so far that you abandon the main XP lane.",
            "Do not let the first few upgrades become random picks; this phase needs a coherent line.",
          ], seed + 1),
        };
  }

  if (nearbyGems >= 8 && nearEnemies <= 2) {
    return locale === "zh"
      ? {
          phase: "资源回收窗口",
          best: pickVariant([
            "场上有一波安全资源可以吃，优先把这片经验球收干净，把领先转成下一次升级。",
            "这是典型的回收时间，先走一条短线路把近处经验吸完，再决定往哪边转场。",
            "你刚清出了一块真空区，立刻把资源兑现，不要让经验球散掉。",
          ], seed),
          avoid: pickVariant([
            "不要在安全窗口里空转。",
            "不要为了追孤立怪把整片近身资源放掉。",
            "不要刚清完局面又主动把自己送回高压区。",
          ], seed + 1),
        }
      : {
          phase: "Resource collection window",
          best: pickVariant([
            "You have a safe pocket of resources. Vacuum up the nearby gems first and convert this opening into the next level.",
            "This is a cleanup window, so run a short route through the closest XP cluster before rotating again.",
            "You just created real space. Cash it in immediately instead of letting the gems sit on the floor.",
          ], seed),
          avoid: pickVariant([
            "Do not drift around during a free collection window.",
            "Do not abandon a whole gem pocket just to chase one isolated enemy.",
            "Do not walk yourself back into pressure right after stabilizing the board.",
          ], seed + 1),
        };
  }

  if (pressure <= 6 && hpRatio >= 0.7 && buildPower >= 55) {
    return locale === "zh"
      ? {
          phase: "滚雪球阶段",
          best: pickVariant([
            "你已经拿到主动权了，继续边清边收，把节奏滚成连续升级。",
            "现在可以更主动一点，优先处理最近的怪群，让场面一直保持在你可控的密度。",
            "这段时间适合扩大领先，把安全清怪直接转化成经验和分数。",
          ], seed),
          avoid: pickVariant([
            "不要在优势局面里无意义绕远。",
            "不要为了保守过头而浪费这段低压力时间。",
            "不要让自己的走位和火力脱节，领先时更该持续收缩残局。",
          ], seed + 1),
        }
      : {
          phase: "Snowball phase",
          best: pickVariant([
            "You have control now. Keep clearing while collecting and turn this into back-to-back levels.",
            "This is the time to play forward a bit more, trim the nearest pack, and keep the board at a density you can dictate.",
            "Use the safe state to widen your lead by converting low-risk clears into XP and score.",
          ], seed),
          avoid: pickVariant([
            "Do not waste a lead by wandering without purpose.",
            "Do not become so passive that the low-pressure window expires unused.",
            "Do not let your movement and firing rhythm disconnect when the board is already under control.",
          ], seed + 1),
        };
  }

  if (buildLean === "survival" && buildPower < 58) {
    return locale === "zh"
      ? {
          phase: "伤害补课阶段",
          best: pickVariant([
            "你的容错已经够了，下一步该补的是清怪效率，不然中后段会越拖越挤。",
            "现在最缺的是把安全感转成处理速度，优先补射速或伤害。",
            "这套 build 偏稳，但再不补输出就会开始靠走位硬拖波次。",
          ], seed),
          avoid: pickVariant([
            "不要继续堆血量和移速，局面已经在提醒你火力不够。",
            "不要误以为能活就算稳，清不动怪同样会慢性崩盘。",
            "不要忽视升级后的击杀速度变化，它决定你能不能保住节奏。",
          ], seed + 1),
        }
      : {
          phase: "Damage catch-up phase",
          best: pickVariant([
            "Your survivability is fine; what the run needs next is faster clearing before the later waves start to stack up.",
            "Convert safety into kill speed now. Fire rate or damage is the cleanest next investment.",
            "This build is stable, but it is about to rely too much on pure movement unless you patch the offensive side.",
          ], seed),
          avoid: pickVariant([
            "Do not keep stacking HP and speed when the board is clearly asking for damage.",
            "Do not confuse 'still alive' with 'actually stable'; slow clears collapse later.",
            "Do not ignore how much level-ups should change your kill tempo.",
          ], seed + 1),
        };
  }

  if (xpRatio >= 0.75 && nearbyGems >= 4) {
    return locale === "zh"
      ? {
          phase: "冲级过渡阶段",
          best: pickVariant([
            "离下一次升级已经很近了，优先规划一条安全吃满经验的短路线。",
            "这波更适合稳稳拿等级，不必急着拼极限击杀。",
            "把眼前这批经验兑现成升级，再利用升级窗口重新定 build 方向。",
          ], seed),
          avoid: pickVariant([
            "不要在快升级时把自己送进乱团。",
            "不要忽视近身经验球，差一点点时最容易因为贪远处而亏掉节奏。",
            "不要为了追单个目标打断升级前的收资源路线。",
          ], seed + 1),
        }
      : {
          phase: "Level-rush transition",
          best: pickVariant([
            "You are close to the next level, so route through the safest gem line and secure the upgrade first.",
            "This is a good moment to play for the level itself rather than forcing max kills.",
            "Cash in the nearby XP, trigger the upgrade, and let that choice redefine the next segment of the run.",
          ], seed),
          avoid: pickVariant([
            "Do not dive into chaos when the next level is already within reach.",
            "Do not ignore nearby gems and overchase a distant target right before leveling.",
            "Do not break your collection route for one low-value duel.",
          ], seed + 1),
        };
  }

  return locale === "zh"
    ? {
        phase: "中盘控场阶段",
        best: pickVariant([
          "继续维持移动节奏，把怪群揉成一团后从外侧慢慢削。",
          "当前局面更适合稳控密度，别急着硬冲，先用走位把怪线拉顺。",
          "中盘最重要的是保持场面秩序，让击杀、经验和走位三件事重新对齐。",
        ], seed),
        avoid: pickVariant([
          "不要直线穿最密的怪堆。",
          "不要在没有清出口的时候突然折返。",
          "不要只顾击杀而失去对怪群形状的控制。",
        ], seed + 1),
      }
    : {
        phase: "Mid-run control phase",
        best: pickVariant([
          "Keep the movement rhythm steady, compress the swarm into one mass, and shave it from the outside.",
          "This board wants density control more than heroics. Straighten the enemy line with movement before forcing damage.",
          "The mid game is about re-aligning kills, XP flow, and positioning so the run stays orderly.",
        ], seed),
        avoid: pickVariant([
          "Do not run straight through the densest pack.",
          "Do not hard turn back before you have opened an exit lane.",
          "Do not focus so much on killing that you lose control of the swarm shape.",
        ], seed + 1),
      };
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
    const params = new URLSearchParams(window.location.search);
    const queryLocale = params.get("lang");
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (queryLocale === "en" || queryLocale === "zh") {
      setLocale(queryLocale);
    } else if (storedLocale === "en" || storedLocale === "zh") {
      setLocale(storedLocale);
    }
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
  const dynamicPrediction = useMemo(() => buildPrediction(game, locale), [game, locale]);
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
            <LocaleSwitcher locale={locale} label={locale === "zh" ? "语言" : "Language"} onLocaleChange={setLocale} />
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
                  <p className="mt-1 text-base text-white">{dynamicPrediction.phase}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{t.bestDirection}</p>
                  <p className="mt-1">{dynamicPrediction.best}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">{t.avoidLine}</p>
                  <p className="mt-1">{dynamicPrediction.avoid}</p>
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
