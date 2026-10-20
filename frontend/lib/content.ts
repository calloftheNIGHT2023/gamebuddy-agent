// 文案配置中心，集中维护多语言文本和游戏介绍。
import type { GameKey, Locale } from "@/lib/types";

export const translations = {
  en: {
    badge: "Game guide",
    title: "GameBuddy",
    subtitle:
      "Game questions, builds and match reviews.",
    chips: ["Game guides", "Builds", "Match reviews"],
    imageNote: "Game worlds",
    emptyResult: "Enter the game state to see the next move and match review.",
    summary: "Summary",
    risks: "Watch for",
    nextSteps: "Next moves",
    openReview: "Read match review",
    promptsTitle: "Sample requests",
    formTabs: { json: "Game state", screenshot: "Import image" },
    gameLabel: "Game",
    questionLabel: "Question",
    jsonLabel: "Game state JSON",
    screenshotLabel: "Image",
    screenshotHelp: "Image recognition is unavailable; this option analyzes the selected game's sample state.",
    submit: "Run analysis",
    loading: "Analyzing...",
    chooseFile: "Choose an image first.",
    genericError: "Something went wrong.",
    langLabel: "Language",
    reviewTitle: "Review report",
    reviewBack: "Back to analysis",
    likelyMistakes: "Things to revisit",
    recommendedActions: "Next moves",
    longerTerm: "Practice next time",
    noReview: "Analyze a position first to see its review here.",
    returnHome: "Return home",
    playTitle: "Playable modules",
    playBody: "Choose a game and start playing.",
    playCta: "Browse games",
    logTitle: "Recent updates",
    logEntries: [
      "Read the position before choosing the next move.",
      "Play turn battles, action games and build challenges in the browser.",
      "Ask about tactics and revisit match decisions.",
      "Choose the next game from the game hub.",
    ],
  },
  zh: {
    badge: "游戏攻略",
    title: "GameBuddy",
    subtitle: "游戏问答、角色配装与战局复盘。",
    chips: ["游戏攻略", "角色配装", "战局复盘"],
    imageNote: "游戏场景",
    emptyResult: "填写局势后，查看下一步打法与战局复盘。",
    summary: "摘要",
    risks: "需要留意",
    nextSteps: "下一步打法",
    openReview: "查看战局复盘",
    promptsTitle: "示例提问",
    formTabs: { json: "填写局势", screenshot: "导入图片" },
    gameLabel: "游戏",
    questionLabel: "问题",
    jsonLabel: "游戏状态 JSON",
    screenshotLabel: "图片",
    screenshotHelp: "当前不识别图片，仅分析所选游戏的样例局势。",
    submit: "开始分析",
    loading: "分析中...",
    chooseFile: "请先选择图片。",
    genericError: "请求失败，请重试。",
    langLabel: "语言",
    reviewTitle: "复盘报告",
    reviewBack: "返回分析台",
    likelyMistakes: "值得复查",
    recommendedActions: "下次怎么打",
    longerTerm: "练习方向",
    noReview: "先完成一次战局分析，这里就会显示复盘。",
    returnHome: "返回首页",
    playTitle: "可玩模块",
    playBody: "选一个游戏，直接开始。",
    playCta: "进入游戏大厅",
    logTitle: "最近更新",
    logEntries: [
      "先看当前局势，再决定下一步打法。",
      "回合对战、动作闯关与角色配装，都能直接游玩。",
      "在游戏问答中查打法，在战局复盘中找问题。",
      "在游戏大厅选择下一局。",
    ],
  },
} as const;

export const gameOptions: Record<GameKey, { en: string; zh: string }> = {
  "pokemon-battle-demo": { en: "Pokemon Battle", zh: "宝可梦对战" },
  "moba-postmatch-demo": { en: "MOBA Review", zh: "MOBA 复盘" },
  "rpg-build-demo": { en: "RPG Builds", zh: "RPG 配装" },
};

export const promptSets: Record<GameKey, Record<Locale, string[]>> = {
  "pokemon-battle-demo": {
    en: [
      "What should I do next?",
      "What should I adjust here?",
      "Give me 3 beginner tips for this position.",
      "What is the safest play if I want consistency?",
      "Which threat matters most right now?",
      "What should my win condition be from this state?",
    ],
    zh: [
      "我下一步应该做什么？",
      "这个局面最该调整什么？",
      "给我 3 条适合新手的建议。",
      "如果我想打得更稳，最安全的选择是什么？",
      "现在最该防谁？",
      "从这个局面看，我的胜利条件是什么？",
    ],
  },
  "moba-postmatch-demo": {
    en: [
      "What should I focus on before the next objective?",
      "What is the biggest post-match issue in this game?",
      "Give me 3 beginner macro tips.",
      "How should I reduce pointless deaths?",
      "What matters more here: farm or setup?",
      "What should my team play around next?",
    ],
    zh: [
      "下一个资源点前我最该做什么？",
      "这局复盘里最大的问题是什么？",
      "给我 3 条适合新手的宏观建议。",
      "我该怎么减少无意义死亡？",
      "这里更重要的是发育还是先做资源点准备？",
      "我们下一波应该围绕什么打？",
    ],
  },
  "rpg-build-demo": {
    en: [
      "What should I upgrade next?",
      "What is wrong with this build?",
      "Give me 3 beginner build tips.",
      "Should I focus damage or survivability first?",
      "Which item slot is weakest right now?",
      "What build direction is strongest from here?",
    ],
    zh: [
      "我下一步应该升级什么？",
      "这套配装最缺什么？",
      "给我 3 条适合新手的配装建议。",
      "我应该先补伤害还是生存？",
      "我现在最弱的是哪个装备槽位？",
      "现有资源该怎么分配？",
    ],
  },
};

export const playHubContent = {
  en: {
    eyebrow: "Game hub",
    title: "Choose your next game",
    description:
      "Play turn battles, try new builds, or jump into an action game.",
    back: "Home",
    open: "Play now",
    modes: {
      "pokemon-duel": {
        title: "Pokemon Duel",
        description: "A compact single-player 1v1 turn battle with chip damage, shields, and burst timing.",
        tag: "Turn battle",
      },
      "heroes-and-monsters": {
        title: "Heroes & Monsters Web",
        description:
          "Explore a map, trade at markets and win turn-based battles.",
        tag: "Adventure RPG",
      },
      "moba-lane": {
        title: "MOBA Lane Mini Match",
        description: "Dodge skills, secure the dragon and push down the lane.",
        tag: "Lane battle",
      },
      "moba-sandbox": {
        title: "MOBA Review Sandbox",
        description: "A macro sandbox for objective timing, vision tradeoffs, and post-match review patterns.",
        tag: "Strategy",
      },
      "rpg-build-lab": {
        title: "RPG Builds",
        description: "A build-tuning sandbox for level, stats, resource economy, and progression decisions.",
        tag: "Build planner",
      },
      "survivor-sandbox": {
        title: "Mini Survivor Mode",
        description: "Survive waves of enemies, collect experience and choose your upgrades.",
        tag: "Survival action",
      },
    },
  },
  zh: {
    eyebrow: "游戏大厅",
    title: "选好游戏，直接开局。",
    description: "回合对战、动作闯关与角色配装，选一个开始。",
    back: "返回首页",
    open: "开始游戏",
    modes: {
      "pokemon-duel": {
        title: "宝可梦回合对战",
        description: "一个带有消耗、护盾和爆发时机的小型单机 1v1 回合战。",
        tag: "回合对战",
      },
      "heroes-and-monsters": {
        title: "Heroes & Monsters 网页版",
        description: "探索地图、逛商店，在回合战斗中挑战怪物。",
        tag: "冒险 RPG",
      },
      "moba-lane": {
        title: "MOBA 单线小对局",
        description: "走位、放技能、拿小龙，沿兵线向前推进。",
        tag: "单线对战",
      },
      "moba-sandbox": {
        title: "MOBA 复盘沙盒",
        description: "选择资源点与视野布置，安排下一波行动。",
        tag: "策略沙盒",
      },
      "rpg-build-lab": {
        title: "RPG 配装",
        description: "调整属性与装备，找到适合当前目标的配装。",
        tag: "配装沙盒",
      },
      "survivor-sandbox": {
        title: "迷你生存模式",
        description: "自动射击、躲避追击、收集经验，每次升级选择一项强化。",
        tag: "生存动作",
      },
    },
  },
} as const;
