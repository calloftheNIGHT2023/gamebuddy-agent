// 文案配置中心，集中维护多语言文本和 demo 展示内容。
import type { GameKey, Locale } from "@/lib/types";

export const translations = {
  en: {
    badge: "Build log",
    title: "GameBuddy Agent development log",
    subtitle:
      "A running record of architecture changes, playable prototypes, and decision-engine updates across this browser game analysis lab.",
    chips: ["FastAPI backend", "Next.js + Tailwind frontend", "Agent-style orchestration"],
    imageNote: "Current visual placeholder. Replace it with a real project screenshot when the final capture set is ready.",
    emptyResult: "Submit a screenshot or structured state to generate a phase read, best direction, and review summary.",
    summary: "Summary",
    risks: "Risks and uncertainty",
    nextSteps: "Next-step checklist",
    openReview: "Open review page",
    promptsTitle: "Sample requests",
    formTabs: { json: "Paste game state", screenshot: "Upload screenshot" },
    gameLabel: "Game",
    questionLabel: "Question",
    jsonLabel: "Game state JSON",
    screenshotLabel: "Screenshot",
    screenshotHelp: "Screenshot mode still uses an honest placeholder perception layer in the MVP.",
    submit: "Run analysis",
    loading: "Analyzing...",
    chooseFile: "Choose a screenshot file first.",
    genericError: "Something went wrong.",
    langLabel: "Language",
    reviewTitle: "Review report",
    reviewBack: "Back to log",
    likelyMistakes: "Likely mistakes",
    recommendedActions: "Recommended actions",
    longerTerm: "Longer-term improvement",
    noReview: "No review data yet. Run an analysis from the home page first.",
    returnHome: "Return home",
    playTitle: "Playable modules",
    playBody: "Open the current browser-playable prototypes and sandbox game modules from the play hub.",
    playCta: "Open play hub",
    logTitle: "Recent updates",
    logEntries: [
      "Reframed the analyzer around phase prediction so the response answers what stage the player is in before listing advice.",
      "Added a browser-playable survivor prototype to test lightweight game loops inside the same frontend.",
      "Kept the orchestration layer explicit so perception, strategy, and review logic can be replaced independently.",
      "Expanded the play hub to hold RPG, MOBA, and arcade-style demos under one project surface.",
    ],
  },
  zh: {
    badge: "开发日志",
    title: "GameBuddy Agent 开发更新记录",
    subtitle: "这是一个持续更新的 AI 游戏分析项目日志，记录架构调整、可玩原型和决策引擎的迭代。",
    chips: ["FastAPI 后端", "Next.js + Tailwind 前端", "Agent 式编排结构"],
    imageNote: "这里仍是占位图。等最终演示截图准备好后，可以替换成真实项目画面。",
    emptyResult: "提交截图或结构化状态后，这里会生成阶段判断、最佳方向和复盘摘要。",
    summary: "摘要",
    risks: "风险与不确定性",
    nextSteps: "下一步清单",
    openReview: "打开复盘页",
    promptsTitle: "示例提问",
    formTabs: { json: "粘贴游戏状态", screenshot: "上传截图" },
    gameLabel: "游戏",
    questionLabel: "问题",
    jsonLabel: "游戏状态 JSON",
    screenshotLabel: "截图",
    screenshotHelp: "当前 MVP 的截图模式仍然使用诚实的占位感知层。",
    submit: "开始分析",
    loading: "分析中...",
    chooseFile: "请先选择截图文件。",
    genericError: "发生了一点问题。",
    langLabel: "语言",
    reviewTitle: "复盘报告",
    reviewBack: "返回日志页",
    likelyMistakes: "可能的问题",
    recommendedActions: "建议动作",
    longerTerm: "长期改进",
    noReview: "还没有复盘数据，请先在首页完成一次分析。",
    returnHome: "返回首页",
    playTitle: "可玩模块",
    playBody: "从游戏大厅进入当前已经可玩的浏览器原型和沙盒模块。",
    playCta: "进入游戏大厅",
    logTitle: "最近更新",
    logEntries: [
      "把分析结果改成先判断当前阶段，再输出建议，避免只有泛泛的提示语。",
      "新增了一个类吸血鬼幸存者的浏览器原型，用来验证轻量动作循环。",
      "保留清晰的编排层，让感知、策略和复盘逻辑可以独立替换。",
      "把 RPG、MOBA 和街机原型统一收到 play hub，形成一个完整展示面。",
    ],
  },
} as const;

export const gameOptions: Record<GameKey, { en: string; zh: string }> = {
  "pokemon-battle-demo": { en: "Pokemon Battle Demo", zh: "宝可梦回合制 Demo" },
  "moba-postmatch-demo": { en: "MOBA Post-match Demo", zh: "MOBA 复盘 Demo" },
  "rpg-build-demo": { en: "RPG Build Demo", zh: "RPG 配装 Demo" },
};

export const promptSets: Record<GameKey, Record<Locale, string[]>> = {
  "pokemon-battle-demo": {
    en: [
      "What should I do next?",
      "What is my biggest mistake here?",
      "Give me 3 beginner tips for this position.",
      "What is the safest play if I want consistency?",
      "Which threat matters most right now?",
      "What should my win condition be from this state?",
    ],
    zh: [
      "我下一步应该做什么？",
      "这里我最大的失误是什么？",
      "给我 3 条适合新手的建议。",
      "如果我想打得更稳，最安全的选择是什么？",
      "现在最需要尊重的威胁是什么？",
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
      "这套 Build 最大的问题是什么？",
      "给我 3 条适合新手的配装建议。",
      "我应该先补伤害还是生存？",
      "我现在最弱的是哪个装备槽位？",
      "从当前资源看，最强的构筑方向是什么？",
    ],
  },
};

export const playHubContent = {
  en: {
    eyebrow: "Playable modules",
    title: "Browser game builds and sandboxes",
    description:
      "This section tracks the current playable surfaces in the repo, from small solo demos to larger browser prototypes.",
    back: "Back to log",
    open: "Open mode",
    modes: {
      "pokemon-duel": {
        title: "Pokemon Duel Lab",
        description: "A compact single-player 1v1 turn battle with chip damage, shields, and burst timing.",
        tag: "Mini battle demo",
      },
      "heroes-and-monsters": {
        title: "Heroes & Monsters Web",
        description:
          "A browser adaptation of the Java console RPG with map exploration, markets, and turn-based battles.",
        tag: "Full playable adaptation",
      },
      "moba-lane": {
        title: "MOBA Lane Mini Match",
        description: "A single-lane solo demo focused on farming, recalls, dragon timing, and tower pressure.",
        tag: "Mini macro demo",
      },
      "moba-sandbox": {
        title: "MOBA Review Sandbox",
        description: "A macro sandbox for objective timing, vision tradeoffs, and post-match review patterns.",
        tag: "Playable strategy sandbox",
      },
      "rpg-build-lab": {
        title: "RPG Build Lab",
        description: "A build-tuning sandbox for level, stats, resource economy, and progression decisions.",
        tag: "Playable build sandbox",
      },
      "survivor-sandbox": {
        title: "Mini Survivor Mode",
        description: "A simple survivor prototype with auto fire, chase mobs, XP gems, and upgrade picks.",
        tag: "Arcade action prototype",
      },
    },
  },
  zh: {
    eyebrow: "可玩模块",
    title: "浏览器游戏构建与沙盒原型",
    description: "这里集中展示仓库里当前已经可玩的模块，包括小型单机 Demo 和更完整的浏览器原型。",
    back: "返回日志页",
    open: "打开模式",
    modes: {
      "pokemon-duel": {
        title: "宝可梦对战小实验",
        description: "一个带有消耗、护盾和爆发时机的小型单机 1v1 回合战。",
        tag: "迷你战斗 Demo",
      },
      "heroes-and-monsters": {
        title: "Heroes & Monsters 网页版",
        description: "把 Java 控制台 RPG 改造成浏览器版本，包含地图探索、商店和回合战斗。",
        tag: "完整可玩改编",
      },
      "moba-lane": {
        title: "MOBA 单线小对局",
        description: "一个围绕补刀、回城、小龙和推塔节奏的单线单机 Demo。",
        tag: "迷你宏观 Demo",
      },
      "moba-sandbox": {
        title: "MOBA 复盘沙盒",
        description: "一个用于资源点时机、视野取舍和赛后复盘的宏观沙盒。",
        tag: "策略沙盒",
      },
      "rpg-build-lab": {
        title: "RPG 配装实验室",
        description: "一个用于等级、属性、资源经济和成长方向调整的配装沙盒。",
        tag: "配装沙盒",
      },
      "survivor-sandbox": {
        title: "迷你生存模式",
        description: "一个简化的生存动作原型，包含自动攻击、追怪、经验球和升级三选一。",
        tag: "街机动作原型",
      },
    },
  },
} as const;
