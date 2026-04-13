"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/types";

import {
  valorHeroes,
  valorItems,
  valorMonsters,
  type ValorHeroClass,
  type ValorHeroTemplate,
  type ValorItemTemplate,
} from "@/lib/valor-data";

type TileKind = "common" | "market" | "wall";

type BoardTile = {
  id: string;
  x: number;
  y: number;
  kind: TileKind;
  marketItemIds: string[];
};

type HeroState = {
  id: string;
  name: string;
  heroClass: ValorHeroClass;
  level: number;
  experience: number;
  gold: number;
  mana: number;
  maxMana: number;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  dexterity: number;
  inventory: string[];
  equippedWeaponId: string | null;
  equippedArmorId: string | null;
  actedThisRound: boolean;
};

type MonsterState = {
  id: string;
  name: string;
  kind: string;
  level: number;
  hp: number;
  maxHp: number;
  damage: number;
  defense: number;
  dodge: number;
};

type BattleState = {
  monsters: MonsterState[];
  selectedMonsterId: string | null;
  message: string;
  turn: number;
};

function randomFrom<T>(items: T[], count: number): T[] {
  return [...items].sort(() => Math.random() - 0.5).slice(0, count);
}

function itemById(itemId: string | null) {
  return valorItems.find((item) => item.id === itemId) ?? null;
}

function generateBoard(): BoardTile[] {
  const tiles: BoardTile[] = [];

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const safeStart = (x === 0 && y === 0) || (x === 1 && y === 0) || (x === 0 && y === 1);
      let kind: TileKind = "common";
      const roll = Math.random();

      if (!safeStart) {
        if (roll < 0.2) {
          kind = "wall";
        } else if (roll < 0.5) {
          kind = "market";
        }
      }

      tiles.push({
        id: `tile-${x}-${y}`,
        x,
        y,
        kind,
        marketItemIds: kind === "market" ? randomFrom(valorItems, 4).map((item) => item.id) : [],
      });
    }
  }

  return tiles;
}

function buildHero(template: ValorHeroTemplate): HeroState {
  const level = 1 + Math.floor(template.experience / 5);
  const inventory = ["healing-draught"];
  if (template.heroClass === "Sorcerer") {
    inventory.push("glacier-bite");
  }

  return {
    id: template.id,
    name: template.name,
    heroClass: template.heroClass,
    level,
    experience: template.experience,
    gold: template.gold,
    mana: template.mana,
    maxMana: template.mana,
    hp: level * 100,
    maxHp: level * 100,
    strength: template.strength,
    agility: template.agility,
    dexterity: template.dexterity,
    inventory,
    equippedWeaponId: null,
    equippedArmorId: null,
    actedThisRound: false,
  };
}

function monsterForLevel(level: number, index: number): MonsterState {
  const pool = valorMonsters.filter((monster) => Math.abs(monster.level - level) <= 2);
  const template = (pool.length > 0 ? pool : valorMonsters)[index % (pool.length > 0 ? pool.length : valorMonsters.length)];
  const scaledLevel = Math.max(level, template.level);

  return {
    id: `${template.id}-${index}-${Date.now()}`,
    name: template.name,
    kind: template.kind,
    level: scaledLevel,
    hp: scaledLevel * 90 + Math.round(template.defense * 0.25),
    maxHp: scaledLevel * 90 + Math.round(template.defense * 0.25),
    damage: template.damage,
    defense: template.defense,
    dodge: template.dodge,
  };
}

const copy = {
  en: {
    defaultLog: "This browser mode adapts the classic Heroes and Monsters gameplay into a web UI.",
    expeditionStart: "A new expedition begins. Move across the board, enter markets, and survive monster encounters.",
    borderBlocked: "The border blocks your path.",
    wallBlocked: "An inaccessible tile blocks the route.",
    reachedMarket: "You reached a market. You can buy weapons, armor, potions, and spells here.",
    luckyLoot: (name: string) => `Lucky find: your party found ${name}.`,
    luckyGold: (gold: number) => `Lucky find: the party discovered ${gold} gold.`,
    battleStart: "A battle has started. Heroes act from the card controls, then monsters retaliate.",
    encounter: (names: string) => `Encounter triggered: ${names}.`,
    equipped: (name: string) => `${name} equipped.`,
    potionUsed: (hero: string, item: string) => `${hero} used ${item}.`,
    bought: (hero: string, item: string) => `${hero} bought ${item}.`,
    missed: (monster: string, hero: string) => `${monster} missed ${hero}.`,
    hit: (monster: string, hero: string, damage: number) => `${monster} hit ${hero} for ${damage}.`,
    defeatMessage: "Defeat. Your party was wiped out in this expedition.",
    defeatLog: "Defeat: all heroes were knocked out.",
    victory: (gold: number, xp: number) => `Victory: the party earned ${gold} gold and ${xp} experience.`,
    attackMessage: (hero: string, weapon: string) => `${hero} attacked with ${weapon}.`,
    castMessage: (hero: string, spell: string) => `${hero} cast ${spell}.`,
    introEyebrow: "Playable web adaptation",
    introTitle: "Heroes & Monsters, rebuilt for the browser.",
    introBody:
      "The original `valogame-base` repository is a Java console RPG. This page ports its classic mode into a playable web interface with board exploration, markets, hero progression, and turn-based battles.",
    back: "Back to log",
    chooseHeroes: "Choose up to 3 heroes",
    mana: "Mana",
    strength: "Strength",
    agility: "Agility",
    dexterity: "Dexterity",
    start: "Start browser expedition",
    restart: "Restart expedition",
    clearSave: "Clear save",
    included: "What is included from the original game",
    includedList: [
      "8x8 board exploration with safe starting tiles",
      "Warrior, Sorcerer, and Paladin hero classes",
      "Dragon, Exoskeleton, and Spirit encounters",
      "Markets with weapons, armor, potions, and spells",
      "Random loot events and turn-based battles",
      "Level progression and combat rewards",
    ],
    includedFoot: "This is a web adaptation, not a raw terminal embed. The second mode, Legends of Valor, is not ported yet.",
    eyebrow: "Heroes & Monsters Web",
    title: "Classic mode, redesigned away from the terminal.",
    resetRun: "Reset run",
    allGames: "All games",
    board: "Board",
    boardHelp: "Explore, enter markets, and survive battles. Markets are gold tiles, walls are blocked stone tiles.",
    position: (x: number, y: number) => `Position ${x},${y}`,
    partyTile: "Party",
    marketTile: "Market",
    wallTile: "Wall",
    fieldTile: "Field",
    north: "Move North",
    west: "Move West",
    east: "Move East",
    south: "Move South",
    market: "Market",
    marketHelp: "Buy gear for the currently selected hero.",
    costLevel: (cost: number, level: number) => `Cost ${cost} · Min level ${level}`,
    buy: "Buy",
    party: "Party",
    partyHelp: "Switch focus between heroes and manage their inventory.",
    level: (level: number) => `Level ${level}`,
    gold: "Gold",
    xp: "XP",
    weapon: "Weapon",
    armor: "Armor",
    none: "None",
    noInventory: "No inventory yet.",
    equip: "Equip",
    use: "Use",
    eventLog: "Event log",
    battle: "Battle",
    round: (round: number) => `Round ${round}`,
    closeBattle: "Close battle view",
    heroes: "Heroes",
    acted: "Acted",
    ready: "Ready",
    attack: "Attack",
    monsters: "Monsters",
    alive: "Alive",
    defeated: "Defeated",
  },
  zh: {
    defaultLog: "这个浏览器模式把经典的 Heroes & Monsters 玩法改造成了网页界面。",
    expeditionStart: "新的远征开始了。穿过棋盘、进入商店，并在怪物遭遇战中生存下来。",
    borderBlocked: "边界挡住了你的去路。",
    wallBlocked: "前方是不可通行的障碍格。",
    reachedMarket: "你进入了商店。这里可以购买武器、防具、药水和法术。",
    luckyLoot: (name: string) => `幸运事件：队伍找到了 ${name}。`,
    luckyGold: (gold: number) => `幸运事件：队伍发现了 ${gold} 金币。`,
    battleStart: "战斗开始。英雄先行动，然后怪物会进行反击。",
    encounter: (names: string) => `遭遇触发：${names}。`,
    equipped: (name: string) => `已装备 ${name}。`,
    potionUsed: (hero: string, item: string) => `${hero} 使用了 ${item}。`,
    bought: (hero: string, item: string) => `${hero} 购买了 ${item}。`,
    missed: (monster: string, hero: string) => `${monster} 没有打中 ${hero}。`,
    hit: (monster: string, hero: string, damage: number) => `${monster} 对 ${hero} 造成了 ${damage} 点伤害。`,
    defeatMessage: "失败。你的队伍在本次远征中全灭了。",
    defeatLog: "失败：所有英雄都倒下了。",
    victory: (gold: number, xp: number) => `胜利：队伍获得了 ${gold} 金币和 ${xp} 点经验。`,
    attackMessage: (hero: string, weapon: string) => `${hero} 使用 ${weapon} 发起攻击。`,
    castMessage: (hero: string, spell: string) => `${hero} 施放了 ${spell}。`,
    introEyebrow: "网页可玩改编版",
    introTitle: "Heroes & Monsters 浏览器版",
    introBody: "原始的 `valogame-base` 是一个 Java 控制台 RPG。这个页面把它的经典模式移植成了包含棋盘探索、商店、角色成长和回合战斗的网页版本。",
    back: "返回日志页",
    chooseHeroes: "最多选择 3 名英雄",
    mana: "法力",
    strength: "力量",
    agility: "敏捷",
    dexterity: "技巧",
    start: "开始网页远征",
    restart: "重新远征",
    clearSave: "清除存档",
    included: "当前已移植内容",
    includedList: [
      "8x8 棋盘探索与安全起始区域",
      "Warrior、Sorcerer、Paladin 三种职业",
      "Dragon、Exoskeleton、Spirit 等遭遇战",
      "武器、防具、药水和法术商店",
      "随机掉落事件与回合制战斗",
      "升级成长与战斗奖励",
    ],
    includedFoot: "这是网页改编版，不是终端嵌入。第二模式 Legends of Valor 目前还没有移植。",
    eyebrow: "Heroes & Monsters 网页版",
    title: "经典模式的浏览器重构版。",
    resetRun: "重置本轮",
    allGames: "全部游戏",
    board: "棋盘",
    boardHelp: "探索地图、进入商店并在战斗中生存。金色格子是商店，深色格子是障碍。",
    position: (x: number, y: number) => `位置 ${x},${y}`,
    partyTile: "队伍",
    marketTile: "商店",
    wallTile: "障碍",
    fieldTile: "地块",
    north: "向北移动",
    west: "向西移动",
    east: "向东移动",
    south: "向南移动",
    market: "商店",
    marketHelp: "为当前选中的英雄购买装备。",
    costLevel: (cost: number, level: number) => `价格 ${cost} · 最低等级 ${level}`,
    buy: "购买",
    party: "队伍",
    partyHelp: "切换英雄焦点并管理背包。",
    level: (level: number) => `等级 ${level}`,
    gold: "金币",
    xp: "经验",
    weapon: "武器",
    armor: "护甲",
    none: "无",
    noInventory: "背包还是空的。",
    equip: "装备",
    use: "使用",
    eventLog: "事件日志",
    battle: "战斗",
    round: (round: number) => `第 ${round} 回合`,
    closeBattle: "关闭战斗面板",
    heroes: "英雄",
    acted: "已行动",
    ready: "待命",
    attack: "攻击",
    monsters: "怪物",
    alive: "存活",
    defeated: "已击败",
  },
} as const;

export function ValorGame({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [heroes, setHeroes] = useState<HeroState[]>([]);
  const [board, setBoard] = useState<BoardTile[]>([]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [log, setLog] = useState<string[]>([copy[initialLocale].defaultLog]);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const currentTile = board.find((tile) => tile.x === position.x && tile.y === position.y) ?? null;
  const currentHero = heroes.find((hero) => hero.id === selectedHeroId) ?? heroes[0] ?? null;
  const aliveHeroes = heroes.filter((hero) => hero.hp > 0);
  const t = copy[locale];

  const marketItems = useMemo(() => {
    if (!currentTile || currentTile.kind !== "market") {
      return [];
    }
    return currentTile.marketItemIds
      .map((itemId) => itemById(itemId))
      .filter((item): item is ValorItemTemplate => Boolean(item));
  }, [currentTile]);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("gamebuddy:locale");
    if (storedLocale === "en" || storedLocale === "zh") {
      setLocale(storedLocale);
    }
    const raw = window.localStorage.getItem("gamebuddy:valor-save");
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        selectedHeroes: string[];
        heroes: HeroState[];
        board: BoardTile[];
        position: { x: number; y: number };
        log: string[];
        battle: BattleState | null;
        selectedHeroId: string | null;
        started: boolean;
      };
      setSelectedHeroes(parsed.selectedHeroes ?? []);
      setHeroes(parsed.heroes ?? []);
      setBoard(parsed.board ?? []);
      setPosition(parsed.position ?? { x: 0, y: 0 });
      setLog(parsed.log ?? []);
      setBattle(parsed.battle ?? null);
      setSelectedHeroId(parsed.selectedHeroId ?? null);
      setStarted(Boolean(parsed.started));
    } catch {
      window.localStorage.removeItem("gamebuddy:valor-save");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "gamebuddy:valor-save",
      JSON.stringify({
        selectedHeroes,
        heroes,
        board,
        position,
        log,
        battle,
        selectedHeroId,
        started,
      })
    );
  }, [selectedHeroes, heroes, board, position, log, battle, selectedHeroId, started]);

  function pushLog(message: string) {
    setLog((current) => [message, ...current].slice(0, 14));
  }

  function startGame() {
    const picked = valorHeroes.filter((hero) => selectedHeroes.includes(hero.id)).slice(0, 3).map(buildHero);
    if (picked.length === 0) {
      return;
    }
    setHeroes(picked);
    setSelectedHeroId(picked[0].id);
    setBoard(generateBoard());
    setPosition({ x: 0, y: 0 });
    setBattle(null);
    setStarted(true);
    setLog([t.expeditionStart]);
  }

  function toggleHero(heroId: string) {
    setSelectedHeroes((current) => {
      if (current.includes(heroId)) {
        return current.filter((id) => id !== heroId);
      }
      if (current.length >= 3) {
        return current;
      }
      return [...current, heroId];
    });
  }

  function move(dx: number, dy: number) {
    if (!started || battle) {
      return;
    }
    const nextX = position.x + dx;
    const nextY = position.y + dy;
    const tile = board.find((entry) => entry.x === nextX && entry.y === nextY);

    if (!tile) {
      pushLog(t.borderBlocked);
      return;
    }
    if (tile.kind === "wall") {
      pushLog(t.wallBlocked);
      return;
    }

    setPosition({ x: nextX, y: nextY });

    if (tile.kind === "market") {
      pushLog(t.reachedMarket);
      return;
    }

    const roll = Math.random();
    if (roll < 0.1) {
      if (Math.random() < 0.5) {
        const loot = randomFrom(valorItems, 1)[0];
        setHeroes((current) =>
          current.map((hero, index) => (index === 0 ? { ...hero, inventory: [...hero.inventory, loot.id] } : hero))
        );
        pushLog(t.luckyLoot(loot.name));
      } else {
        const gold = 300 + Math.round(Math.random() * 500);
        setHeroes((current) => current.map((hero) => ({ ...hero, gold: hero.gold + gold })));
        pushLog(t.luckyGold(gold));
      }
      return;
    }

    if (roll < 0.55) {
      const highestLevel = Math.max(...aliveHeroes.map((hero) => hero.level));
      const encounterCount = Math.max(1, Math.min(2, aliveHeroes.length));
      const monsters = Array.from({ length: encounterCount }, (_, index) => monsterForLevel(highestLevel, index));
      setBattle({
        monsters,
        selectedMonsterId: monsters[0]?.id ?? null,
        message: t.battleStart,
        turn: 1,
      });
      setHeroes((current) => current.map((hero) => ({ ...hero, actedThisRound: false })));
      pushLog(t.encounter(monsters.map((monster) => monster.name).join(", ")));
    }
  }

  function equipItem(heroId: string, itemId: string) {
    const item = itemById(itemId);
    if (!item || item.kind === "potion" || item.kind === "spell") {
      return;
    }
    setHeroes((current) =>
      current.map((hero) => {
        if (hero.id !== heroId || !hero.inventory.includes(itemId) || hero.level < item.minLevel) {
          return hero;
        }
        return {
          ...hero,
          equippedWeaponId: item.kind === "weapon" ? itemId : hero.equippedWeaponId,
          equippedArmorId: item.kind === "armor" ? itemId : hero.equippedArmorId,
        };
      })
    );
    pushLog(t.equipped(item.name));
  }

  function drinkPotion(heroId: string, itemId: string) {
    const item = itemById(itemId);
    if (!item || item.kind !== "potion") {
      return;
    }
    setHeroes((current) =>
      current.map((hero) => {
        if (hero.id !== heroId || !hero.inventory.includes(itemId)) {
          return hero;
        }
        const nextInventory = [...hero.inventory];
        nextInventory.splice(nextInventory.indexOf(itemId), 1);
        return {
          ...hero,
          hp: Math.min(hero.maxHp, hero.hp + (item.healHp ?? 0)),
          mana: Math.min(hero.maxMana, hero.mana + (item.healMana ?? 0)),
          inventory: nextInventory,
        };
      })
    );
    pushLog(t.potionUsed(heroes.find((hero) => hero.id === heroId)?.name ?? "Hero", item.name));
  }

  function buyItem(itemId: string) {
    if (!currentHero || !currentTile || currentTile.kind !== "market") {
      return;
    }
    const item = itemById(itemId);
    if (!item || currentHero.gold < item.cost || currentHero.level < item.minLevel) {
      return;
    }
    setHeroes((current) =>
      current.map((hero) =>
        hero.id === currentHero.id
          ? { ...hero, gold: hero.gold - item.cost, inventory: [...hero.inventory, item.id] }
          : hero
      )
    );
    pushLog(t.bought(currentHero.name, item.name));
  }

  function finishHeroAction(nextHeroes: HeroState[], nextBattle: BattleState) {
    const livingHeroes = nextHeroes.filter((hero) => hero.hp > 0);
    const allActed = livingHeroes.every((hero) => hero.actedThisRound);

    if (!allActed) {
      setHeroes(nextHeroes);
      setBattle(nextBattle);
      return;
    }

    const afterMonsterTurnHeroes = nextHeroes.map((hero) => ({ ...hero }));
    const afterMonsterTurnMonsters = nextBattle.monsters.map((monster) => ({ ...monster }));
    const battleMessages: string[] = [];

    for (const monster of afterMonsterTurnMonsters) {
      if (monster.hp <= 0) {
        continue;
      }
      const targets = afterMonsterTurnHeroes.filter((hero) => hero.hp > 0);
      if (targets.length === 0) {
        break;
      }
      const target = targets[Math.floor(Math.random() * targets.length)];
      const dodgeChance = Math.min(0.5, target.agility * 0.0008);
      if (Math.random() < dodgeChance) {
        battleMessages.push(t.missed(monster.name, target.name));
        continue;
      }
      const armor = itemById(target.equippedArmorId);
      const damage = Math.max(20, Math.round(monster.damage * 0.08 - (armor?.defense ?? 0) * 0.25));
      target.hp = Math.max(0, target.hp - damage);
      battleMessages.push(t.hit(monster.name, target.name, damage));
    }

    const livingAfterMonsters = afterMonsterTurnHeroes.filter((hero) => hero.hp > 0);
    if (livingAfterMonsters.length === 0) {
      setHeroes(afterMonsterTurnHeroes);
      setBattle({
        ...nextBattle,
        message: t.defeatMessage,
      });
      pushLog(t.defeatLog);
      return;
    }

    setHeroes(afterMonsterTurnHeroes.map((hero) => ({ ...hero, actedThisRound: false })));
    setBattle({
      ...nextBattle,
      monsters: afterMonsterTurnMonsters,
      turn: nextBattle.turn + 1,
      message: battleMessages.join(" "),
    });
  }

  function resolveVictory(nextHeroes: HeroState[]) {
    const rewardGold = 450;
    const rewardXp = 4;
    const rewarded = nextHeroes.map((hero) => {
      if (hero.hp <= 0) {
        return hero;
      }
      let level = hero.level;
      let experience = hero.experience + rewardXp;
      let maxHp = hero.maxHp;
      let maxMana = hero.maxMana;
      let strength = hero.strength;
      let agility = hero.agility;
      let dexterity = hero.dexterity;

      while (experience >= level * 10 && level < 10) {
        experience -= level * 10;
        level += 1;
        maxHp = level * 100;
        maxMana = Math.round(maxMana * 1.08);
        if (hero.heroClass === "Warrior") {
          strength = Math.round(strength * 1.12);
          agility = Math.round(agility * 1.08);
          dexterity = Math.round(dexterity * 1.06);
        } else if (hero.heroClass === "Sorcerer") {
          strength = Math.round(strength * 1.06);
          agility = Math.round(agility * 1.08);
          dexterity = Math.round(dexterity * 1.12);
        } else {
          strength = Math.round(strength * 1.1);
          agility = Math.round(agility * 1.08);
          dexterity = Math.round(dexterity * 1.1);
        }
      }

      return {
        ...hero,
        level,
        experience,
        gold: hero.gold + rewardGold,
        maxHp,
        hp: Math.min(maxHp, hero.hp + Math.round(maxHp * 0.1)),
        maxMana,
        mana: Math.min(maxMana, hero.mana + Math.round(maxMana * 0.1)),
        strength,
        agility,
        dexterity,
        actedThisRound: false,
      };
    });

    setHeroes(rewarded);
    setBattle(null);
    pushLog(t.victory(rewardGold, rewardXp));
  }

  function attackWithHero(heroId: string) {
    if (!battle) {
      return;
    }
    const hero = heroes.find((entry) => entry.id === heroId);
    if (!hero || hero.hp <= 0 || hero.actedThisRound) {
      return;
    }

    const targetId = battle.selectedMonsterId ?? battle.monsters.find((monster) => monster.hp > 0)?.id ?? null;
    if (!targetId) {
      return;
    }

    const weapon = itemById(hero.equippedWeaponId);
    const updatedHeroes = heroes.map((entry) =>
      entry.id === heroId ? { ...entry, actedThisRound: true } : { ...entry }
    );
    const updatedBattle = {
      ...battle,
      monsters: battle.monsters.map((monster) => {
        if (monster.id !== targetId) {
          return { ...monster };
        }
        const dodgeChance = Math.min(0.5, monster.dodge / 100);
        if (Math.random() < dodgeChance) {
          return { ...monster };
        }
        const damage = Math.max(25, Math.round(hero.strength * 0.05 + (weapon?.damage ?? 0) - monster.defense * 0.03));
        return { ...monster, hp: Math.max(0, monster.hp - damage) };
      }),
      message: t.attackMessage(hero.name, weapon?.name ?? "base damage"),
    };

    const remainingMonsters = updatedBattle.monsters.filter((monster) => monster.hp > 0);
    if (remainingMonsters.length === 0) {
      resolveVictory(updatedHeroes);
      return;
    }

    finishHeroAction(updatedHeroes, {
      ...updatedBattle,
      selectedMonsterId: remainingMonsters[0]?.id ?? null,
    });
  }

  function castSpell(heroId: string, spellId: string) {
    if (!battle) {
      return;
    }
    const hero = heroes.find((entry) => entry.id === heroId);
    const spell = itemById(spellId);
    if (!hero || !spell || spell.kind !== "spell" || hero.hp <= 0 || hero.actedThisRound || hero.mana < (spell.manaCost ?? 0)) {
      return;
    }

    const targetId = battle.selectedMonsterId ?? battle.monsters.find((monster) => monster.hp > 0)?.id ?? null;
    if (!targetId) {
      return;
    }

    const updatedHeroes = heroes.map((entry) =>
      entry.id === heroId
        ? { ...entry, mana: entry.mana - (spell.manaCost ?? 0), actedThisRound: true }
        : { ...entry }
    );

    const updatedBattle = {
      ...battle,
      monsters: battle.monsters.map((monster) => {
        if (monster.id !== targetId) {
          return { ...monster };
        }
        const damage = Math.max(40, Math.round((spell.spellDamage ?? 0) + hero.dexterity * 0.03 - monster.defense * 0.015));
        return { ...monster, hp: Math.max(0, monster.hp - damage) };
      }),
      message: t.castMessage(hero.name, spell.name),
    };

    const remainingMonsters = updatedBattle.monsters.filter((monster) => monster.hp > 0);
    if (remainingMonsters.length === 0) {
      resolveVictory(updatedHeroes);
      return;
    }

    finishHeroAction(updatedHeroes, {
      ...updatedBattle,
      selectedMonsterId: remainingMonsters[0]?.id ?? null,
    });
  }

  function resetRun() {
    setSelectedHeroes([]);
    setHeroes([]);
    setBoard([]);
    setPosition({ x: 0, y: 0 });
    setLog([t.defaultLog]);
    setBattle(null);
    setSelectedHeroId(null);
    setStarted(false);
    window.localStorage.removeItem("gamebuddy:valor-save");
  }

  if (!started) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(231,193,121,0.35),transparent_28%),linear-gradient(180deg,#f7f2e8_0%,#e7efe8_100%)] px-6 py-10 text-ink md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ember">{t.introEyebrow}</p>
              <h1 className="mt-3 font-display text-5xl leading-tight">{t.introTitle}</h1>
              <p className="mt-4 max-w-3xl text-base text-ink/72">{t.introBody}</p>
            </div>
            <div className="flex items-center gap-3">
              <LocaleSwitcher locale={locale} label={locale === "zh" ? "语言" : "Language"} />
              <Link href={`/?lang=${locale}`} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
                {t.back}
              </Link>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-[2rem] bg-white/80 p-8 shadow-card backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.chooseHeroes}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {valorHeroes.map((hero) => {
                  const selected = selectedHeroes.includes(hero.id);
                  return (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => toggleHero(hero.id)}
                      className={`rounded-[1.6rem] border p-5 text-left transition ${
                        selected ? "border-pine bg-pine text-white" : "border-ink/10 bg-mist hover:bg-white"
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.22em] opacity-70">{hero.heroClass}</p>
                      <h2 className="mt-2 text-xl font-semibold">{hero.name}</h2>
                      <div className="mt-4 space-y-1 text-sm opacity-85">
                        <p>{t.mana} {hero.mana}</p>
                        <p>{t.strength} {hero.strength}</p>
                        <p>{t.agility} {hero.agility}</p>
                        <p>{t.dexterity} {hero.dexterity}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            <button
              type="button"
              disabled={selectedHeroes.length === 0}
              onClick={startGame}
              className="mt-6 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
                {started ? t.restart : t.start}
              </button>
              {started ? (
                <button
                  type="button"
                  onClick={resetRun}
                  className="ml-3 mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-sm"
                >
                  {t.clearSave}
                </button>
              ) : null}
            </section>

            <section className="rounded-[2rem] bg-ink p-8 text-white shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.included}</p>
              <ul className="mt-6 space-y-3 text-sm text-white/78">
                {t.includedList.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-white/60">{t.includedFoot}</p>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f2e8_0%,#ebf1ea_100%)] px-6 py-8 text-ink md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ember">{t.eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl">{t.title}</h1>
          </div>
          <div className="flex gap-3">
            <LocaleSwitcher locale={locale} label={locale === "zh" ? "语言" : "Language"} />
            <button type="button" onClick={resetRun} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
              {t.resetRun}
            </button>
            <Link href={`/play?lang=${locale}`} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
              {t.allGames}
            </Link>
            <Link href={`/?lang=${locale}`} className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-card">
              {t.back}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] bg-white/85 p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.board}</p>
                <p className="mt-1 text-sm text-ink/62">{t.boardHelp}</p>
              </div>
              <div className="rounded-full bg-mist px-4 py-2 text-sm font-semibold">
                {t.position(position.x + 1, position.y + 1)}
              </div>
            </div>

            <div className="grid grid-cols-8 gap-2 rounded-[1.5rem] bg-[#ecf0e4] p-4">
              {board.map((tile) => {
                const isParty = tile.x === position.x && tile.y === position.y;
                const isAdjacent = Math.abs(tile.x - position.x) + Math.abs(tile.y - position.y) === 1;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => move(tile.x - position.x, tile.y - position.y)}
                    disabled={!isAdjacent || battle !== null}
                    className={`aspect-square rounded-[1rem] border text-xs font-semibold transition ${
                      isParty
                        ? "border-pine bg-pine text-white"
                        : tile.kind === "market"
                          ? "border-gold bg-[#f7e7b6] text-ink"
                          : tile.kind === "wall"
                            ? "border-ink/30 bg-[#4d5b66] text-white/70"
                            : "border-ink/10 bg-white text-ink/70"
                    } ${isAdjacent && !battle ? "hover:scale-[1.02]" : ""}`}
                  >
                    {isParty ? t.partyTile : tile.kind === "market" ? t.marketTile : tile.kind === "wall" ? t.wallTile : t.fieldTile}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => move(0, -1)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                {t.north}
              </button>
              <button type="button" onClick={() => move(-1, 0)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                {t.west}
              </button>
              <button type="button" onClick={() => move(1, 0)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                {t.east}
              </button>
              <button type="button" onClick={() => move(0, 1)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
                {t.south}
              </button>
            </div>

            {currentTile?.kind === "market" ? (
              <div className="mt-6 rounded-[1.5rem] border border-gold/50 bg-[#fff8df] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">{t.market}</p>
                    <p className="mt-1 text-sm text-ink/65">{t.marketHelp}</p>
                  </div>
                  <select
                    value={selectedHeroId ?? ""}
                    onChange={(event) => setSelectedHeroId(event.target.value)}
                    className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm"
                  >
                    {heroes.map((hero) => (
                      <option key={hero.id} value={hero.id}>
                        {hero.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {marketItems.map((item) => (
                    <div key={item.id} className="rounded-[1.2rem] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pine">{item.kind}</p>
                          <h3 className="mt-1 text-lg font-semibold">{item.name}</h3>
                          <p className="mt-2 text-sm text-ink/65">{t.costLevel(item.cost, item.minLevel)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => buyItem(item.id)}
                          className="rounded-full bg-pine px-4 py-2 text-xs font-semibold text-white"
                        >
                          {t.buy}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] bg-white/85 p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine">{t.party}</p>
                  <p className="mt-1 text-sm text-ink/62">{t.partyHelp}</p>
                </div>
                <select
                  value={selectedHeroId ?? ""}
                  onChange={(event) => setSelectedHeroId(event.target.value)}
                  className="rounded-full border border-ink/10 bg-mist px-4 py-2 text-sm"
                >
                  {heroes.map((hero) => (
                    <option key={hero.id} value={hero.id}>
                      {hero.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-4">
                {heroes.map((hero) => {
                  const weapon = itemById(hero.equippedWeaponId);
                  const armor = itemById(hero.equippedArmorId);
                  return (
                    <article
                      key={hero.id}
                      className={`rounded-[1.4rem] border p-4 ${selectedHeroId === hero.id ? "border-pine bg-[#edf7f0]" : "border-ink/10 bg-mist"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember">{hero.heroClass}</p>
                          <h3 className="mt-1 text-xl font-semibold">{hero.name}</h3>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                          {t.level(hero.level)}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-ink/70 md:grid-cols-2">
                        <p>HP {hero.hp}/{hero.maxHp}</p>
                        <p>{t.mana} {hero.mana}/{hero.maxMana}</p>
                        <p>{t.gold} {hero.gold}</p>
                        <p>{t.xp} {hero.experience}</p>
                        <p>{t.weapon} {weapon?.name ?? t.none}</p>
                        <p>{t.armor} {armor?.name ?? t.none}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {hero.inventory.length === 0 ? <span className="text-sm text-ink/55">{t.noInventory}</span> : null}
                        {hero.inventory.map((itemId, index) => {
                          const item = itemById(itemId);
                          if (!item) {
                            return null;
                          }
                          return (
                            <div key={`${itemId}-${index}`} className="rounded-full bg-white px-3 py-2 text-xs font-semibold">
                              {item.name}
                              {item.kind === "weapon" || item.kind === "armor" ? (
                                <button type="button" onClick={() => equipItem(hero.id, itemId)} className="ml-2 text-pine">
                                  {t.equip}
                                </button>
                              ) : null}
                              {item.kind === "potion" ? (
                                <button type="button" onClick={() => drinkPotion(hero.id, itemId)} className="ml-2 text-ember">
                                  {t.use}
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold">{t.eventLog}</p>
              <div className="mt-4 space-y-3 text-sm text-white/78">
                {log.map((entry, index) => (
                  <p key={`${entry}-${index}`}>{entry}</p>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {battle ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/55 p-6">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-[2rem] bg-[#fff9ef] p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ember">{t.battle}</p>
                <h2 className="mt-2 text-3xl font-semibold text-ink">{t.round(battle.turn)}</h2>
                <p className="mt-2 text-sm text-ink/65">{battle.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setBattle(null)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm"
              >
                {t.closeBattle}
              </button>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pine">{t.heroes}</p>
                {heroes.map((hero) => {
                  const spells = hero.inventory
                    .map((itemId) => itemById(itemId))
                    .filter((item): item is ValorItemTemplate => Boolean(item && item.kind === "spell"));

                  return (
                    <article key={hero.id} className="rounded-[1.4rem] border border-ink/10 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-ink">{hero.name}</h3>
                          <p className="text-sm text-ink/60">
                            {hero.heroClass} · HP {hero.hp}/{hero.maxHp} · {t.mana} {hero.mana}/{hero.maxMana}
                          </p>
                        </div>
                        <div className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">
                          {hero.actedThisRound ? t.acted : t.ready}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => attackWithHero(hero.id)}
                          disabled={hero.hp <= 0 || hero.actedThisRound}
                          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          {t.attack}
                        </button>
                        {spells.map((spell) => (
                          <button
                            key={spell.id}
                            type="button"
                            onClick={() => castSpell(hero.id, spell.id)}
                            disabled={hero.hp <= 0 || hero.actedThisRound || hero.mana < (spell.manaCost ?? 0)}
                            className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                          >
                            {spell.name}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </section>

              <section className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">{t.monsters}</p>
                {battle.monsters.map((monster) => (
                  <button
                    key={monster.id}
                    type="button"
                    onClick={() => setBattle({ ...battle, selectedMonsterId: monster.id })}
                    className={`w-full rounded-[1.4rem] border p-4 text-left ${
                      battle.selectedMonsterId === monster.id ? "border-ember bg-[#fff1e6]" : "border-ink/10 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-ink">{monster.name}</h3>
                        <p className="text-sm text-ink/60">
                          {monster.kind} · {t.level(monster.level)} · HP {monster.hp}/{monster.maxHp}
                        </p>
                      </div>
                      <div className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">
                        {monster.hp > 0 ? t.alive : t.defeated}
                      </div>
                    </div>
                  </button>
                ))}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
