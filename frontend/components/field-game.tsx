"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { apiRequest, getAdminToken, isLocalPage, jsonPost } from "@/lib/api-client";
import { MemoryUsed } from "@/components/memory-used";
import {
  SCENES, SCENE_ORDER, GRID_WIDTH, GRID_HEIGHT, actionError, canMoveTo, createGame,
  distance, positionLabel, sameCell, snapshotGame, stepGame,
  type FieldAction, type FieldState, type Position, type SceneKey,
} from "@/lib/field-game";
import type { AnalysisResponse } from "@/lib/types";

type Props = { initialScene?: SceneKey; embedded?: boolean; onSceneChange?: (scene: SceneKey) => void };
type SavedAnalysis = { response: AnalysisResponse; turn: number; scene: SceneKey };

function UnitIcon({ enemy = false }: { enemy?: boolean }) {
  return enemy ? (
    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 18 5 7l13 7h12L43 7l-3 12 3 14-12 9H17L5 33z" fill="currentColor" /><path d="m12 23 9 2-5 5zm24 0-9 2 5 5z" fill="#f6f0d5" /><path d="M20 35h8" stroke="#181b1e" strokeWidth="3" /></svg>
  ) : (
    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 23 5 43h38l-7-20z" fill="#f05a32" /><path d="M17 22h14l4 20H13z" fill="currentColor" /><path d="M15 7h18v14H15z" fill="#f3d2a2" /><path d="M12 6h24v7H12zM15 3h15v7H15z" fill="#e5f36a" /><path d="M12 41h10v5H10zm14 0h10l2 5H26z" fill="#181b1e" /><path d="M31 25h4v18h-4z" fill="#e5f36a" /></svg>
  );
}

function GoalIcon({ scene, done }: { scene: SceneKey; done: boolean }) {
  if (done) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m10 25 9 9 19-22" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="miter" /></svg>;
  if (scene === "river") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 43V6h25l-5 9 5 9H16" fill="currentColor" /><path d="M12 6v37" stroke="#181b1e" strokeWidth="4" /><path d="M6 43h21" stroke="#181b1e" strokeWidth="4" /></svg>;
  if (scene === "dungeon") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 3 16 21-16 21L8 24z" fill="currentColor" stroke="#181b1e" strokeWidth="3" /><path d="m24 12 7 12-7 12-7-12z" fill="#f5f1da" /></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 16 12 7h24l6 9v25H6z" fill="currentColor" stroke="#181b1e" strokeWidth="3" /><path d="M7 22h34M17 8v32m14-32v32" stroke="#181b1e" strokeWidth="3" /><path d="M21 20h7v10h-7z" fill="#f7f1d5" /></svg>;
}

function ExitIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 44V13L17 4h16l9 9v31H31V16H18v28z" fill="currentColor" stroke="#181b1e" strokeWidth="2" /><path d="M20 30h14m-5-5 5 5-5 5" fill="none" stroke="#e5f36a" strokeWidth="3" /></svg>;
}

export function FieldGame({ initialScene = "town", embedded = false, onSceneChange }: Props) {
  const [scene, setScene] = useState<SceneKey>(initialScene);
  const [state, setState] = useState(() => createGame(initialScene));
  const [selectedEnemy, setSelectedEnemy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SavedAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [pendingTurn, setPendingTurn] = useState<number | null>(null);
  const currentState = useRef(state);
  const currentScene = useRef(scene);
  const runSequence = useRef(0);
  const runIdentity = useRef<string | null>(null);
  const analysisSequence = useRef(0);
  const board = useRef<HTMLDivElement>(null);

  useEffect(() => () => { runSequence.current += 1; analysisSequence.current += 1; }, []);

  const config = SCENES[scene];
  const livingEnemies = state.enemies.filter((enemy) => enemy.hp > 0).sort((a, b) => distance(a, state.position) - distance(b, state.position));
  const target = livingEnemies.find((enemy) => enemy.id === selectedEnemy) ?? livingEnemies[0];
  const complete = state.objectives.filter((goal) => goal.done).length;
  const stale = analysis !== null && (analysis.turn !== state.turn || analysis.scene !== scene);
  const logs = state.events.slice(-8).reverse();
  const Heading = embedded ? "h2" : "h1";

  function startScene(nextScene: SceneKey) {
    // Requests belong to a run, not just a scene name or a turn number.
    runSequence.current += 1;
    runIdentity.current = crypto.randomUUID();
    analysisSequence.current += 1;
    const next = createGame(nextScene);
    currentScene.current = nextScene;
    currentState.current = next;
    setScene(nextScene);
    setState(next);
    setSelectedEnemy(null);
    setNotice(null);
    setAnalysis(null);
    setAnalysisError(null);
    setPendingTurn(null);
    onSceneChange?.(nextScene);
  }

  function act(action: FieldAction) {
    const problem = actionError(currentState.current, action);
    if (problem) { setNotice(problem); return; }
    const next = stepGame(currentScene.current, currentState.current, action);
    currentState.current = next;
    setState(next);
    setNotice(null);
  }

  function clickCell(position: Position) {
    const enemy = currentState.current.enemies.find((unit) => unit.hp > 0 && sameCell(unit, position));
    if (enemy) { setSelectedEnemy(enemy.id); setNotice(`已选中${enemy.name}。选择攻击或远击。`); return; }
    const player = currentState.current.position;
    if (distance(player, position) !== 1) { setNotice("点击与玩家相邻的一格移动，或使用方向键。" ); return; }
    act({ type: "move", dx: position.x - player.x, dy: position.y - player.y });
  }

  function handleBoardKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = ({ arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] } as Record<string, number[]>)[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    if (!event.repeat) act({ type: "move", dx: direction[0], dy: direction[1] });
  }

  async function analyzeTurn() {
    const snapshot = snapshotGame(currentState.current);
    const snapshotScene = currentScene.current;
    const run = runSequence.current;
    const request = ++analysisSequence.current;
    setPendingTurn(snapshot.turn);
    setAnalysisError(null);
    try {
      let playerId: string | undefined;
      if (isLocalPage() || getAdminToken()) {
        try { const stored = JSON.parse(window.localStorage.getItem("gamebuddy:user-profile") || "null"); if (typeof stored?.user_id === "string" && stored.user_id.trim()) playerId = stored.user_id.trim(); } catch { /* Playing does not require a stored player ID. */ }
      }
      if (playerId && !runIdentity.current) runIdentity.current = crypto.randomUUID();
      const response = await apiRequest<AnalysisResponse>("/play/analyze", jsonPost({ scene: snapshotScene, state: snapshot, player_id: playerId, run_id: playerId ? runIdentity.current : undefined }));
      if (run !== runSequence.current || request !== analysisSequence.current) return;
      const annotated = { ...response, metadata: { ...response.metadata, play_scene: snapshotScene, analyzed_turn: snapshot.turn } };
      setAnalysis({ response: annotated, turn: snapshot.turn, scene: snapshotScene });
      try { window.sessionStorage.setItem("gamebuddy:last-result", JSON.stringify(annotated)); } catch { /* The current answer remains usable without browser storage. */ }
    } catch (error) {
      if (run === runSequence.current && request === analysisSequence.current) setAnalysisError(error instanceof Error ? error.message : "暂时无法分析，请重试。" );
    } finally {
      if (run === runSequence.current && request === analysisSequence.current) setPendingTurn(null);
    }
  }

  const attackAction: FieldAction = { type: "attack", targetId: target?.id ?? "" };
  const skillAction: FieldAction = { type: "skill", targetId: target?.id ?? "" };

  return <section className={`fg-shell ${embedded ? "fg-embedded" : ""}`} aria-label="三场地回合冒险">
    <div className="fg-heading"><div><p className="fg-kicker">FIELD NOTES / 回合冒险</p><Heading>选好路线，留点补给。</Heading></div><span className="fg-edition">9 × 6 / TURN BASED</span></div>
    <div className="fg-scenes" role="group" aria-label="选择场景">
      {SCENE_ORDER.map((item, index) => <button key={item} type="button" aria-pressed={scene === item} onClick={() => startScene(item)}><span>0{index + 1}</span>{SCENES[item].name}<span aria-hidden="true">↗</span></button>)}
    </div>
    <div className="fg-layout">
      <div className="fg-game-column">
        <div className="fg-map-header"><div><p className="fg-kicker">{config.eyebrow}</p><h3>{config.name}</h3></div><div className="fg-turn">回合 <b>{state.turn}</b><span>/ {state.max_turns}</span></div></div>
        <div className="fg-resources" aria-label="玩家状态">
          <div><span>生命</span><b>{state.hp}<small> / {state.max_hp}</small></b><i className="fg-meter"><i style={{ width: `${100 * state.hp / state.max_hp}%` }} /></i></div>
          <div><span>体力</span><b>{state.stamina}<small> / {state.max_stamina}</small></b><i className="fg-meter fg-stamina"><i style={{ width: `${100 * state.stamina / state.max_stamina}%` }} /></i></div>
          <div><span>药水</span><b>{state.potions}<small> 瓶</small></b></div><div><span>金币</span><b>{state.gold}</b></div>
        </div>
        <p className="fg-mission"><span>目标 {complete}/{state.objectives.length}</span>{config.mission}</p>
        <div className="fg-map-wrap">
          <div className="fg-column-labels" aria-hidden="true">{Array.from({ length: GRID_WIDTH }, (_, x) => <span key={x}>{x + 1}</span>)}</div>
          <div ref={board} tabIndex={0} role="group" aria-label={`${config.name}棋盘，9列6行，方向键或WASD移动`} aria-describedby="field-controls-help" className="fg-map" style={{ backgroundImage: `url(${config.image})` }} onKeyDown={handleBoardKey}>
            {Array.from({ length: GRID_HEIGHT }, (_, y) => <div key={y} className="fg-map-row"><span className="fg-row-label" aria-hidden="true">{y + 1}</span>{Array.from({ length: GRID_WIDTH }, (_, x) => {
              const cell = { x, y };
              const wall = state.walls.some((position) => sameCell(position, cell));
              const player = sameCell(state.position, cell);
              const enemy = state.enemies.find((unit) => unit.hp > 0 && sameCell(unit, cell));
              const goal = state.objectives.find((item) => sameCell(item, cell));
              const exit = state.exit !== null && sameCell(state.exit, cell);
              const adjacent = distance(state.position, cell) === 1 && canMoveTo(state, cell);
              const label = `${positionLabel(cell)}${wall ? "，障碍" : ""}${player ? `，玩家，生命${state.hp}` : ""}${enemy ? `，${enemy.name}，生命${enemy.hp}` : ""}${goal ? `，${goal.name}${goal.done ? "，已完成" : ""}` : ""}${exit ? "，出口" : ""}`;
              return <button key={x} type="button" tabIndex={-1} className={`fg-cell${wall ? " is-wall" : ""}${adjacent ? " is-adjacent" : ""}${player ? " is-player" : ""}${enemy && enemy.id === target?.id ? " is-target" : ""}`} onClick={() => clickCell(cell)} aria-label={label} title={label} disabled={state.status !== "playing"}>
                {wall && <span className="fg-wall-mark" aria-hidden="true">×</span>}
                {exit && <span className="fg-symbol fg-exit"><ExitIcon /></span>}
                {goal && <span className={`fg-symbol fg-goal ${goal.done ? "is-done" : ""}`}><GoalIcon scene={scene} done={goal.done} /></span>}
                {enemy && <span className="fg-unit fg-enemy"><UnitIcon enemy /><span className="fg-unit-hp">{enemy.hp}</span></span>}
                {player && <span className="fg-unit fg-player"><UnitIcon /></span>}
              </button>;
            })}</div>)}
            {state.status !== "playing" && <div className="fg-ending" role="status"><span>{state.status === "won" ? "STAGE CLEAR" : "TRY AGAIN"}</span><strong>{state.status === "won" ? "本关胜利！" : "探索结束"}</strong><p>{state.status === "won" ? `第 ${state.turn} 回合，完成全部目标。` : state.hp <= 0 ? "生命耗尽，换条路线再试一次。" : "回合用尽，试着更早规划路线。"}</p></div>}
          </div>
        </div>
        <div className="fg-legend"><span><i className="fg-key-player" />玩家</span><span><i className="fg-key-enemy" />敌人</span><span><i className="fg-key-goal" />{scene === "town" ? "物资" : scene === "river" ? "旗点" : "符文"}</span>{state.exit && <span><i className="fg-key-exit" />出口</span>}<span><i className="fg-key-wall" />障碍</span></div>
        <div className="fg-controls">
          <div className="fg-dpad" aria-label="方向控制"><button type="button" className="fg-up" aria-label="向上移动" onClick={() => act({ type: "move", dx: 0, dy: -1 })} disabled={state.status !== "playing"}>↑</button><button type="button" className="fg-left" aria-label="向左移动" onClick={() => act({ type: "move", dx: -1, dy: 0 })} disabled={state.status !== "playing"}>←</button><span aria-hidden="true">＋</span><button type="button" className="fg-right" aria-label="向右移动" onClick={() => act({ type: "move", dx: 1, dy: 0 })} disabled={state.status !== "playing"}>→</button><button type="button" className="fg-down" aria-label="向下移动" onClick={() => act({ type: "move", dx: 0, dy: 1 })} disabled={state.status !== "playing"}>↓</button></div>
          <div className="fg-action-area"><p id="field-controls-help">点击相邻格移动；点击敌人选中目标。棋盘获得焦点后，可用方向键 / WASD。</p><div className="fg-actions"><button type="button" onClick={() => act(attackAction)} disabled={Boolean(actionError(state, attackAction))} title={actionError(state, attackAction) ?? "相邻攻击，伤害4"}>攻击<small>−1 体力</small></button><button type="button" onClick={() => act(skillAction)} disabled={Boolean(actionError(state, skillAction))} title={actionError(state, skillAction) ?? "2格内远击，伤害6"}>远击<small>−2 体力</small></button><button type="button" onClick={() => act({ type: "rest" })} disabled={Boolean(actionError(state, { type: "rest" }))}>休息<small>＋4 体力</small></button><button type="button" onClick={() => act({ type: "potion" })} disabled={Boolean(actionError(state, { type: "potion" }))}>药水<small>＋8 生命</small></button></div></div>
        </div>
        <p className="fg-notice" role="status">{notice ?? state.events[state.events.length - 1]?.text}</p>
        {livingEnemies.length > 0 && <div className="fg-targets" role="group" aria-label="选择攻击目标"><span>选择目标</span>{livingEnemies.map((enemy) => <button key={enemy.id} type="button" aria-pressed={target?.id === enemy.id} onClick={() => setSelectedEnemy(enemy.id)}>{enemy.name}<small>{enemy.hp}/{enemy.max_hp} HP · {distance(enemy, state.position)} 格</small></button>)}</div>}
        <div className="fg-bottom-bar"><button type="button" onClick={() => startScene(scene)}>↺ 重新开始</button>{state.status === "won" && <button type="button" className="fg-continue" onClick={() => startScene(SCENE_ORDER[(SCENE_ORDER.indexOf(scene) + 1) % SCENE_ORDER.length])}>继续 <span aria-hidden="true">→</span></button>}<span>攻击 {state.attack} / 防御 {state.defense}</span></div>
        <details className="fg-rules"><summary>玩法与本关地形</summary><p>{config.description}</p><ul><li>移动消耗 1 体力。拿到目标会获得 5 金币。</li><li>攻击命中相邻敌人，造成 {state.attack} 伤害；远击命中 2 格内的敌人，造成 {state.attack + 2} 伤害。</li><li>休息和药水也会推进一回合。敌人相邻时攻击，否则沿可走路线前进一格；前进后不会立即攻击。</li><li>{scene === "town" ? "镇外野兽只在偶数回合行动。" : "敌人每回合行动。"}生命耗尽或回合用尽即结束；完成目标的最后一步直接获胜。</li></ul></details>
      </div>
      <aside className="fg-analysis-column" aria-label="当前局势与回合日志">
        <section className="fg-analysis"><div className="fg-aside-heading"><p className="fg-kicker">THE NEXT MOVE</p><h3>这一步，怎么走？</h3></div><p className="fg-analysis-intro">该打、该绕，还是先歇一回合？</p><button type="button" className="fg-analyze-button" onClick={analyzeTurn} disabled={pendingTurn !== null}>{pendingTurn !== null ? `正在分析第 ${pendingTurn} 回合…` : "分析这一步"}<span aria-hidden="true">↗</span></button>
          {analysisError && <p className="fg-analysis-error" role="alert">{analysisError}</p>}
          {analysis && <div className={`fg-answer ${stale ? "is-stale" : ""}`}><p className="fg-answer-stamp">{SCENES[analysis.scene].name} / 第 {analysis.turn} 回合</p>{stale && <p className="fg-stale" role="status">局势已改变，重新分析可查看第 {state.turn} 回合的建议。</p>}<h4>{analysis.response.summary}</h4><div className="fg-answer-direction"><span>优先方向</span><p>{analysis.response.direction_prediction.best_direction}</p></div><ol>{analysis.response.next_steps.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}.</span>{step}</li>)}</ol></div>}
          {analysis && <MemoryUsed metadata={analysis.response.metadata} />}
          {!analysis && !analysisError && <p className="fg-analysis-empty">先走一步，或直接分析开局。建议会标明对应的回合。</p>}
        </section>
        <section className="fg-log"><div className="fg-log-heading"><h3>刚刚发生了什么</h3><span>TURN LOG</span></div><ol>{logs.map((item, index) => <li key={`${item.turn}-${item.kind}-${index}`} className={`fg-event-${item.kind}`}><span>{String(item.turn).padStart(2, "0")}</span><p>{item.text}</p></li>)}</ol></section>
      </aside>
    </div>
  </section>;
}
