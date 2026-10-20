/** Original turn-based field game. All game rules are deterministic and local. */
export type SceneKey = "town" | "river" | "dungeon";
export type Position = { x: number; y: number };
export type Enemy = Position & { id: string; name: string; hp: number; max_hp: number; attack: number };
export type Objective = Position & { id: string; name: string; done: boolean };
export type GameEvent = { turn: number; text: string; kind: string };

export type FieldState = {
  turn: number; max_turns: number;
  hp: number; max_hp: number; stamina: number; max_stamina: number;
  attack: number; defense: number; potions: number; gold: number;
  position: Position; enemies: Enemy[]; objectives: Objective[];
  exit: Position | null; walls: Position[];
  status: "playing" | "won" | "lost";
  events: GameEvent[]; last_action: string;
};

export type FieldAction =
  | { type: "move"; dx: number; dy: number }
  | { type: "attack" | "skill"; targetId: string }
  | { type: "rest" }
  | { type: "potion" };

export type SceneConfig = {
  id: SceneKey; name: string; eyebrow: string; image: string; description: string;
  mission: string; start: Position; maxTurns: number; walls: Position[];
  enemies: Enemy[]; objectives: Objective[]; exit: Position | null;
};

export const GRID_WIDTH = 9;
export const GRID_HEIGHT = 6;
export const SCENE_ORDER: SceneKey[] = ["town", "river", "dungeon"];

const cells = (positions: number[][]): Position[] => positions.map(([x, y]) => ({ x, y }));
const enemy = (id: string, name: string, x: number, y: number, hp: number, attack = 3): Enemy => ({ id, name, x, y, hp, max_hp: hp, attack });
const objective = (id: string, name: string, x: number, y: number): Objective => ({ id, name, x, y, done: false });

export const SCENES: Record<SceneKey, SceneConfig> = {
  town: {
    id: "town", name: "松风镇", eyebrow: "01 / 镇间寻踪", image: "/images/pixel-overworld.png",
    description: "沿着镇间小路找回物资，避开房屋与树丛，带着补给返回镇门。",
    mission: "找齐 3 份物资，再回到镇门。野兽每隔一回合行动。",
    start: { x: 1, y: 5 }, maxTurns: 42,
    walls: cells([[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [4, 1], [5, 1], [6, 1], [7, 1], [7, 2], [2, 3], [2, 4], [7, 4], [8, 4], [7, 5], [8, 5], [0, 4]]),
    enemies: [enemy("town-fox", "荒野狐", 4, 3, 6), enemy("town-wolf", "林间狼", 6, 4, 6)],
    objectives: [objective("town-west", "西街物资", 1, 2), objective("town-east", "东街物资", 6, 2), objective("town-gate", "城旁物资", 8, 3)],
    exit: { x: 1, y: 5 },
  },
  river: {
    id: "river", name: "河谷争夺", eyebrow: "02 / 河道前线", image: "/images/pixel-tactics.png",
    description: "从西岸渡过桥口，夺下三面旗帜。敌方斥候会沿可走路线步步逼近。",
    mission: "走到 3 面旗帜处完成占领。河水与树林不可通行。",
    start: { x: 0, y: 2 }, maxTurns: 44,
    walls: cells([[1, 0], [1, 2], [1, 3], [1, 4], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 2], [7, 2], [6, 3], [7, 3], [8, 1], [3, 0], [4, 0], [5, 0]]),
    enemies: [enemy("river-scout", "河谷斥候", 4, 3, 8), enemy("river-raider", "东岸守兵", 7, 4, 8)],
    objectives: [objective("river-west", "西侧旗点", 2, 2), objective("river-north", "北侧旗点", 5, 1), objective("river-east", "东侧旗点", 8, 4)],
    exit: null,
  },
  dungeon: {
    id: "dungeon", name: "地牢余火", eyebrow: "03 / 深处归途", image: "/images/pixel-dungeon.png",
    description: "在石墙之间寻找两枚符文，利用远击消灭挡路守卫，从东南出口带走余火。",
    mission: "取回 2 枚符文，再抵达出口。守卫每回合都会行动。",
    start: { x: 1, y: 5 }, maxTurns: 48,
    walls: cells([[1, 0], [2, 0], [4, 0], [6, 0], [0, 1], [4, 1], [6, 1], [1, 3], [3, 3], [4, 3], [5, 3], [7, 3], [8, 3], [0, 4], [3, 4], [7, 4], [0, 5], [3, 5]]),
    enemies: [enemy("dungeon-guard", "石门守卫", 5, 2, 10, 4), enemy("dungeon-warden", "余火看守", 6, 5, 8)],
    objectives: [objective("dungeon-west", "古井符文", 2, 1), objective("dungeon-east", "祭坛符文", 7, 0)],
    exit: { x: 8, y: 5 },
  },
};

export const distance = (a: Position, b: Position): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const sameCell = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;
export const positionLabel = (position: Position): string => `第${position.x + 1}列第${position.y + 1}行`;
export const inBounds = (position: Position): boolean => Number.isInteger(position.x) && Number.isInteger(position.y) && position.x >= 0 && position.x < GRID_WIDTH && position.y >= 0 && position.y < GRID_HEIGHT;
const key = (position: Position) => `${position.x},${position.y}`;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createGame(scene: SceneKey): FieldState {
  const config = SCENES[scene];
  return {
    turn: 0, max_turns: config.maxTurns,
    hp: 24, max_hp: 24, stamina: 10, max_stamina: 10,
    attack: 4, defense: 1, potions: 2, gold: 0,
    position: { ...config.start }, enemies: copy(config.enemies), objectives: copy(config.objectives),
    exit: config.exit ? { ...config.exit } : null, walls: copy(config.walls), status: "playing",
    events: [{ turn: 0, text: `抵达${config.name}。${config.mission}`, kind: "start" }], last_action: "开始",
  };
}

export function snapshotGame(state: FieldState): FieldState {
  return copy({ ...state, events: state.events.slice(-24) });
}

export function canMoveTo(state: FieldState, destination: Position): boolean {
  return inBounds(destination) && !state.walls.some((wall) => sameCell(wall, destination))
    && !state.enemies.some((unit) => unit.hp > 0 && sameCell(unit, destination));
}

export function actionError(state: FieldState, action: FieldAction): string | null {
  if (state.status !== "playing") return "本局已经结束，重新开始或继续下一关。";
  if (action.type === "move") {
    if (!Number.isInteger(action.dx) || !Number.isInteger(action.dy) || Math.abs(action.dx) + Math.abs(action.dy) !== 1) return "每次只能向相邻一格移动。";
    if (state.stamina < 1) return "体力不足，先休息恢复。";
    if (!canMoveTo(state, { x: state.position.x + action.dx, y: state.position.y + action.dy })) return "这格被障碍或敌人挡住了。";
  } else if (action.type === "attack" || action.type === "skill") {
    const target = state.enemies.find((unit) => unit.id === action.targetId && unit.hp > 0);
    if (!target) return "先选择一个仍在场上的敌人。";
    if (distance(state.position, target) > (action.type === "skill" ? 2 : 1)) return action.type === "skill" ? "远击只能命中两格以内的敌人。" : "攻击需要与敌人相邻。";
    if (state.stamina < (action.type === "skill" ? 2 : 1)) return "体力不足，先休息恢复。";
  } else if (action.type === "rest") {
    if (state.stamina >= state.max_stamina) return "体力已满，选择其他行动。";
  } else if (action.type === "potion") {
    if (state.potions <= 0) return "药水已经用完了。";
    if (state.hp >= state.max_hp) return "生命已满，暂时不需要药水。";
  } else {
    return "无法执行这个行动。";
  }
  return null;
}

/** Find one step on the shortest route, respecting walls and living units. */
export function findPathStep(state: FieldState, from: Position, to: Position, ignoreEnemyId?: string): Position | null {
  if (sameCell(from, to)) return null;
  const blocked = new Set(state.walls.map(key));
  state.enemies.filter((unit) => unit.hp > 0 && unit.id !== ignoreEnemyId).forEach((unit) => blocked.add(key(unit)));
  const queue: { cell: Position; first: Position | null }[] = [{ cell: from, first: null }];
  const seen = new Set([key(from)]);
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const direction of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
      const next = { x: current.cell.x + direction.x, y: current.cell.y + direction.y };
      if (!inBounds(next) || blocked.has(key(next)) || seen.has(key(next))) continue;
      const first = current.first ?? next;
      if (sameCell(next, to)) return first;
      seen.add(key(next));
      queue.push({ cell: next, first });
    }
  }
  return null;
}

function event(state: FieldState, kind: string, text: string) {
  state.events.push({ turn: state.turn, text, kind });
}

function finishObjective(state: FieldState): boolean {
  for (const goal of state.objectives) {
    if (!goal.done && sameCell(state.position, goal)) {
      goal.done = true;
      state.gold += 5;
      event(state, "objective", `取得「${goal.name}」，金币 +5。`);
    }
  }
  if (state.objectives.every((goal) => goal.done) && (!state.exit || sameCell(state.position, state.exit))) {
    state.status = "won";
    event(state, "victory", "所有目标已完成，本关胜利！");
    return true;
  }
  return false;
}

export function stepGame(scene: SceneKey, state: FieldState, action: FieldAction): FieldState {
  if (actionError(state, action)) return state;
  const next = copy(state);
  next.turn += 1;
  if (action.type === "move") {
    next.position.x += action.dx;
    next.position.y += action.dy;
    next.stamina -= 1;
    next.last_action = "移动";
    event(next, "move", `移动到${positionLabel(next.position)}，体力 −1。`);
  } else if (action.type === "attack" || action.type === "skill") {
    const target = next.enemies.find((unit) => unit.id === action.targetId)!;
    const cost = action.type === "skill" ? 2 : 1;
    const damage = Math.min(target.hp, next.attack + (action.type === "skill" ? 2 : 0));
    target.hp = Math.max(0, target.hp - damage);
    next.stamina -= cost;
    next.last_action = action.type === "skill" ? "远击" : "攻击";
    event(next, action.type, `${next.last_action}命中${target.name}，造成 ${damage} 点伤害，体力 −${cost}。`);
    if (target.hp === 0) event(next, "defeat", `${target.name}被击败。`);
  } else if (action.type === "rest") {
    const recovered = Math.min(4, next.max_stamina - next.stamina);
    next.stamina += recovered;
    next.last_action = "休息";
    event(next, "rest", `休息恢复 ${recovered} 点体力。`);
  } else {
    const healed = Math.min(8, next.max_hp - next.hp);
    next.hp += healed;
    next.potions -= 1;
    next.last_action = "药水";
    event(next, "potion", `使用药水，恢复 ${healed} 点生命。`);
  }
  // A completed final objective ends the turn before enemies can attack again.
  if (!finishObjective(next)) {
    if (scene !== "town" || next.turn % 2 === 0) {
      for (const unit of next.enemies) {
        if (unit.hp <= 0) continue;
        if (distance(unit, next.position) === 1) {
          const damage = Math.min(next.hp, Math.max(1, unit.attack - next.defense));
          next.hp -= damage;
          event(next, "enemy_attack", `${unit.name}攻击，失去 ${damage} 点生命。`);
        } else {
          const destination = findPathStep(next, unit, next.position, unit.id);
          if (destination) {
            unit.x = destination.x;
            unit.y = destination.y;
            event(next, "enemy_move", `${unit.name}前进到${positionLabel(unit)}。`);
          }
        }
        if (next.hp <= 0) break;
      }
    } else if (next.enemies.some((unit) => unit.hp > 0)) {
      event(next, "enemy_wait", "镇外野兽本回合暂未行动。" );
    }
    if (next.hp <= 0 || next.turn >= next.max_turns) {
      next.status = "lost";
      event(next, "loss", next.hp <= 0 ? "生命耗尽，本次探索结束。" : "回合耗尽，本次探索结束。" );
    }
  }
  next.events = next.events.slice(-120);
  return next;
}
