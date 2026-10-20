const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(readFileSync(path.join(__dirname, "../lib/field-game.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleStub = { exports: {} };
vm.runInNewContext(compiled, { module: moduleStub, exports: moduleStub.exports });
const game = moduleStub.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

function assertLegalState(state) {
  assert.ok(state.hp >= 0 && state.hp <= state.max_hp);
  assert.ok(state.stamina >= 0 && state.stamina <= state.max_stamina);
  assert.ok(state.potions >= 0);
  assert.ok(game.inBounds(state.position));
  assert.ok(!state.walls.some((wall) => game.sameCell(wall, state.position)));
  const occupied = new Set([`${state.position.x},${state.position.y}`]);
  for (const unit of state.enemies) {
    assert.ok(game.inBounds(unit));
    assert.ok(unit.hp >= 0 && unit.hp <= unit.max_hp);
    if (unit.hp > 0) {
      assert.ok(!state.walls.some((wall) => game.sameCell(wall, unit)));
      const position = `${unit.x},${unit.y}`;
      assert.ok(!occupied.has(position), "Living units cannot overlap");
      occupied.add(position);
    }
  }
  for (const goal of state.objectives) {
    assert.ok(game.inBounds(goal));
    assert.ok(!state.walls.some((wall) => game.sameCell(wall, goal)));
  }
  if (state.exit) assert.ok(!state.walls.some((wall) => game.sameCell(wall, state.exit)));
}

/** A legal human-style plan: fight nearby guards, recover, then walk to goals. */
function playToEnd(scene, reverseGoals = false) {
  let state = game.createGame(scene);
  const actions = [];
  const states = [state];
  for (let attempt = 0; attempt < 150 && state.status === "playing"; attempt += 1) {
    const enemies = state.enemies.filter((unit) => unit.hp > 0).sort((a, b) => game.distance(a, state.position) - game.distance(b, state.position));
    const enemy = enemies[0];
    let action;
    if (state.hp <= state.max_hp - 8 && state.potions > 0) action = { type: "potion" };
    else if (enemy && game.distance(enemy, state.position) <= 2 && state.stamina >= 2) action = { type: "skill", targetId: enemy.id };
    else if (enemy && game.distance(enemy, state.position) <= 1 && state.stamina >= 1) action = { type: "attack", targetId: enemy.id };
    else if (state.stamina <= 1) action = { type: "rest" };
    else {
      const unfinished = state.objectives.filter((goal) => !goal.done);
      const goals = reverseGoals ? unfinished.reverse() : unfinished.sort((a, b) => game.distance(a, state.position) - game.distance(b, state.position));
      const destination = goals[0] ?? state.exit;
      assert.ok(destination, "A playing state must still have a destination");
      // In the dungeon a guard blocks the corridor. Plan towards the corridor
      // to get within attack range; the actual move is still checked below.
      const next = game.findPathStep(state, state.position, destination)
        ?? game.findPathStep({ ...state, enemies: [] }, state.position, destination);
      assert.ok(next, `${scene}: destination is unreachable`);
      action = { type: "move", dx: next.x - state.position.x, dy: next.y - state.position.y };
    }
    assert.equal(game.actionError(state, action), null, `${scene}: every solver action must be legal`);
    const next = game.stepGame(scene, state, action);
    assert.notEqual(next, state);
    assert.equal(next.turn, state.turn + 1);
    assertLegalState(next);
    actions.push(action);
    states.push(next);
    state = next;
  }
  return { state, actions, states };
}

for (const scene of ["town", "river", "dungeon"]) {
  test(`${scene}: opening matches the shared native-state contract`, () => {
    const state = game.createGame(scene);
    assert.deepEqual(Object.keys(state).sort(), ["turn", "max_turns", "hp", "max_hp", "stamina", "max_stamina", "attack", "defense", "potions", "gold", "position", "enemies", "objectives", "exit", "walls", "status", "events", "last_action"].sort());
    assert.equal(state.status, "playing");
    assert.equal(state.turn, 0);
    assert.equal(state.hp, 24);
    assert.equal(state.stamina, 10);
    assert.equal(state.objectives.length, scene === "dungeon" ? 2 : 3);
    assert.equal(state.exit === null, scene === "river");
    assertLegalState(state);
  });

  test(`${scene}: a complete sequence of legal actions wins the actual game`, () => {
    const { state, actions, states } = playToEnd(scene);
    assert.equal(state.status, "won", `${scene} failed after ${state.turn} turns`);
    assert.ok(state.turn <= state.max_turns);
    assert.ok(state.hp > 0);
    assert.ok(state.objectives.every((goal) => goal.done));
    assert.equal(state.gold, state.objectives.length * 5);
    if (state.exit) assert.ok(game.sameCell(state.position, state.exit));
    assert.ok(actions.some((action) => action.type === "skill"));
    assert.ok(actions.some((action) => action.type === "rest"));
    assert.equal(state.events[state.events.length - 1].kind, "victory");
    assert.equal(game.stepGame(scene, state, { type: "rest" }), state);
    if (scene === "dungeon") {
      const firstRune = states.findIndex((item) => item.objectives.some((goal) => goal.done));
      assert.ok(actions.slice(firstRune).some((action) => action.type === "skill"), "The corridor guard must be fought after collecting the first rune");
    }
  });

  test(`${scene}: a different goal order also has a winning route`, () => {
    const { state } = playToEnd(scene, true);
    assert.equal(state.status, "won", `${scene}: alternate path failed at turn ${state.turn}`);
  });
}

test("blocked, diagonal, out-of-bounds and unknown actions never advance time", () => {
  const river = game.createGame("river");
  for (const action of [{ type: "move", dx: -1, dy: 0 }, { type: "move", dx: 1, dy: 0 }, { type: "move", dx: 1, dy: 1 }, { type: "move", dx: 2, dy: 0 }, { type: "move", dx: 0.5, dy: 0.5 }, { type: "teleport" }]) {
    assert.ok(game.actionError(river, action));
    assert.equal(game.stepGame("river", river, action), river);
  }
  const town = game.stepGame("town", game.createGame("town"), { type: "move", dx: 0, dy: -1 });
  assert.equal(game.stepGame("town", town, { type: "move", dx: 1, dy: 0 }), town, "A building blocks the adjacent cell");
});

test("valid movement consumes stamina and leaves the input state unchanged", () => {
  const original = game.createGame("town");
  const before = plain(original);
  const next = game.stepGame("town", original, { type: "move", dx: 1, dy: 0 });
  assert.deepEqual(plain(original), before);
  assert.deepEqual(plain(next.position), { x: 2, y: 5 });
  assert.equal(next.turn, 1);
  assert.equal(next.stamina, 9);
  const tired = { ...original, stamina: 0 };
  assert.equal(game.stepGame("town", tired, { type: "move", dx: 1, dy: 0 }), tired);
});

test("town enemies wait on odd turns and move on even turns", () => {
  const initial = game.createGame("town");
  const first = game.stepGame("town", initial, { type: "move", dx: 1, dy: 0 });
  assert.deepEqual(plain(first.enemies), plain(initial.enemies));
  assert.ok(first.events.some((event) => event.kind === "enemy_wait" && event.turn === 1));
  const second = game.stepGame("town", first, { type: "rest" });
  assert.notDeepEqual(plain(second.enemies), plain(first.enemies));
  assert.ok(second.events.some((event) => event.kind === "enemy_move" && event.turn === 2));
});

test("attack and ranged skill use their exact costs, range and actual damage", () => {
  const base = game.createGame("river");
  const state = { ...base, position: { x: 4, y: 1 } };
  const target = state.enemies[0];
  assert.ok(game.actionError(state, { type: "attack", targetId: target.id }));
  const first = game.stepGame("river", state, { type: "skill", targetId: target.id });
  assert.equal(first.stamina, 8);
  assert.equal(first.enemies[0].hp, 2);
  assert.equal(first.hp, 24, "An enemy moving into adjacency cannot attack in the same turn");
  const second = game.stepGame("river", first, { type: "attack", targetId: target.id });
  assert.equal(second.stamina, 7);
  assert.equal(second.enemies[0].hp, 0);
  assert.equal(second.enemies.length, base.enemies.length, "Defeated enemies remain in the snapshot");
  assert.ok(second.events.some((event) => event.kind === "attack" && /造成 2 点/.test(event.text)));
  assert.equal(game.stepGame("river", second, { type: "attack", targetId: target.id }), second);
});

test("rest and potion clamp to resource ceilings and reject unnecessary use", () => {
  const initial = game.createGame("town");
  assert.equal(game.stepGame("town", initial, { type: "rest" }), initial);
  assert.equal(game.stepGame("town", initial, { type: "potion" }), initial);
  const tired = { ...initial, stamina: 9 };
  const rested = game.stepGame("town", tired, { type: "rest" });
  assert.equal(rested.stamina, 10);
  assert.equal(rested.turn, 1);
  const injured = { ...initial, hp: 23 };
  const healed = game.stepGame("town", injured, { type: "potion" });
  assert.equal(healed.hp, 24);
  assert.equal(healed.potions, 1);
  assert.equal(healed.turn, 1);
  const empty = { ...injured, potions: 0 };
  assert.equal(game.stepGame("town", empty, { type: "potion" }), empty);
});

test("lethal damage and the turn deadline end the game without negative HP", () => {
  const initial = game.createGame("town");
  const vulnerable = { ...initial, hp: 1, stamina: 5, turn: 1, enemies: [{ id: "danger", name: "守卫", x: 2, y: 5, hp: 6, max_hp: 6, attack: 99 }] };
  const lost = game.stepGame("town", vulnerable, { type: "rest" });
  assert.equal(lost.hp, 0);
  assert.equal(lost.status, "lost");
  assert.equal(game.stepGame("town", lost, { type: "potion" }), lost);
  const deadline = game.stepGame("town", { ...initial, max_turns: 1 }, { type: "move", dx: 1, dy: 0 });
  assert.equal(deadline.turn, 1);
  assert.equal(deadline.status, "lost");
});

test("completing the final objective on the deadline still wins immediately", () => {
  const journey = playToEnd("river");
  const prior = journey.states[journey.states.length - 2];
  const final = game.stepGame("river", { ...prior, max_turns: prior.turn + 1 }, journey.actions[journey.actions.length - 1]);
  assert.equal(final.turn, final.max_turns);
  assert.equal(final.status, "won");
  assert.equal(final.events[final.events.length - 1].kind, "victory");
});

test("restart and scene changes never share mutable enemies, objectives or terrain", () => {
  const old = game.createGame("town");
  old.enemies[0].hp = 0;
  old.objectives[0].done = true;
  old.walls[0].x = 99;
  const restarted = game.createGame("town");
  assert.equal(restarted.enemies[0].hp, 6);
  assert.equal(restarted.objectives[0].done, false);
  assertLegalState(restarted);
  const river = game.createGame("river");
  assert.equal(river.turn, 0);
  assert.equal(river.objectives[0].done, false);
  assertLegalState(river);
});

test("analysis snapshots deep-copy the actual state and contain only the latest 24 events", () => {
  const state = playToEnd("dungeon").state;
  assert.ok(state.events.length > 24);
  const snapshot = game.snapshotGame(state);
  assert.equal(snapshot.events.length, 24);
  assert.deepEqual(plain(snapshot.events), plain(state.events.slice(-24)));
  assert.equal(snapshot.turn, state.turn);
  const before = plain(state);
  snapshot.position.x = 0;
  snapshot.enemies[0].hp = 99;
  snapshot.events[0].text = "replaced";
  assert.deepEqual(plain(state), before);
});
