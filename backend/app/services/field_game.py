"""Deterministic coaching for the browser engine's actual submitted snapshot."""

from collections import deque
from math import ceil

from app.models.field_game import FieldAnalysisRequest, FieldEnemy, FieldState, Position
from app.models.schemas import AnalysisResponse, DirectionPrediction, ReviewSection, TacticalAdviceItem


TITLES = {"town": "松风镇", "river": "河谷争夺", "dungeon": "地牢余火"}
LEGACY_GAMES = {"town": "pokemon-battle-demo", "river": "moba-postmatch-demo", "dungeon": "rpg-build-demo"}
POLICY = {
    "id": "field-game-v1", "name": "原生棋盘规则 v1",
    "prompt": "根据提交的九列六行棋盘、资源和行动记录给出下一步攻略。",
    "instructions": "普攻1体力，技能2体力，休息恢复4体力，药水恢复8血；不调用外部模型。",
    "max_next_steps": 4,
}
DIRECTIONS = ((0, -1, "上"), (1, 0, "右"), (0, 1, "下"), (-1, 0, "左"))


def _distance(left: Position, right: Position) -> int:
    return abs(left.x - right.x) + abs(left.y - right.y)


def _where(position: Position) -> str:
    return f"第{position.x + 1}列第{position.y + 1}行"


def shortest_path(state: FieldState, goal: Position, *, avoid_enemies: bool = True) -> list[tuple[int, int]] | None:
    """Four-neighbour BFS; path excludes the starting cell and includes the goal."""
    start, target = state.position.cell(), goal.cell()
    blocked = {wall.cell() for wall in state.walls}
    if avoid_enemies:
        blocked.update(enemy.cell() for enemy in state.enemies if enemy.hp > 0)
    if target in blocked:
        return None
    pending = deque([(start, [])])
    seen = {start}
    while pending:
        cell, path = pending.popleft()
        if cell == target:
            return path
        for dx, dy, _ in DIRECTIONS:
            neighbour = cell[0] + dx, cell[1] + dy
            if 0 <= neighbour[0] < 9 and 0 <= neighbour[1] < 6 and neighbour not in blocked and neighbour not in seen:
                seen.add(neighbour)
                pending.append((neighbour, [*path, neighbour]))
    return None


def _toward(state: FieldState, step: tuple[int, int]) -> str:
    dx, dy = step[0] - state.position.x, step[1] - state.position.y
    return next(label for sx, sy, label in DIRECTIONS if (sx, sy) == (dx, dy))


def _damage(enemy: FieldEnemy, state: FieldState) -> int:
    return max(1, enemy.attack - state.defense)


def _review(state: FieldState, actions: list[str], situation: str) -> ReviewSection:
    recent = state.events[-6:]
    entries = [f"第{event.turn}回合：{event.text}" for event in recent]
    hits = [event for event in recent if event.kind in {"enemy_attack", "enemy", "loss"}]
    return ReviewSection(
        current_situation=situation + ("\n最近行动：\n" + "\n".join(entries) if entries else "\n还没有行动记录。"),
        likely_mistakes=[f"回看第{event.turn}回合这一步：{event.text}" for event in hits[-3:]],
        recommended_actions=actions,
        longer_term_improvement=["每次移动前看一下身边敌人的距离，再决定赶路还是恢复。", "把到达目标所需步数和剩余体力一起安排，避免临近出口才耗尽体力。"],
    )


def analyze_field_game(payload: FieldAnalysisRequest) -> AnalysisResponse:
    state, scene = payload.state, payload.scene
    title = TITLES[scene]
    completed = sum(objective.done for objective in state.objectives)
    total = len(state.objectives)
    live = [enemy for enemy in state.enemies if enemy.hp > 0]
    situation = f"第{state.turn}回合，位于{_where(state.position)}；生命{state.hp}/{state.max_hp}，体力{state.stamina}/{state.max_stamina}，药水{state.potions}瓶，金币{state.gold}。已完成{completed}/{total}个目标。"
    metadata = {
        "scene": scene, "turn": state.turn, "game_title": title, "source": "field-game",
        "game": LEGACY_GAMES[scene], "task": "field-game", "policy_id": POLICY["id"],
        "llm_status": "disabled", "llm_disabled_reason": "native_rules", "tool_trace": [],
        "completed_objectives": completed, "total_objectives": total,
    }
    if state.status != "playing":
        won = state.status == "won"
        summary = f"{title}通关：{state.turn}回合完成{total}个目标，剩余{state.hp}点生命。" if won else (f"生命归零，这一局在第{state.turn}回合结束。" if state.hp == 0 else f"已到{state.max_turns}回合上限，还差{total - completed}个目标。" if completed < total else f"已到{state.max_turns}回合上限，目标已经收齐，但还没回到出口。")
        actions = ["重新开局，尝试用更少回合完成。"] if won else ["重新开局，优先处理眼前威胁，再沿最短路线完成目标。"]
        return AnalysisResponse(
            summary=summary,
            direction_prediction=DirectionPrediction(current_phase="已通关" if won else "本局结束", best_direction=actions[0], why_now=summary, avoid_direction="本局已结束，无需继续执行移动或战斗。", confidence="high"),
            tactical_advice=[], beginner_explanation=situation, risks_or_uncertainties=[], next_steps=actions,
            review_report=_review(state, actions, situation), metadata=metadata,
        )

    next_enemy_turn = scene != "town" or (state.turn + 1) % 2 == 0
    adjacent = [enemy for enemy in live if _distance(state.position, enemy) == 1]
    incoming = sum(_damage(enemy, state) for enemy in adjacent) if next_enemy_turn else 0
    metadata["next_enemy_turn"] = next_enemy_turn
    metadata["adjacent_damage"] = incoming
    goals = [objective for objective in state.objectives if not objective.done]
    options = [(goal, shortest_path(state, goal)) for goal in goals]
    reachable = [(goal, path) for goal, path in options if path is not None]
    target = min(reachable, key=lambda item: len(item[1])) if reachable else None
    if not goals and state.exit is not None:
        path = shortest_path(state, state.exit)
        target = (state.exit, path) if path is not None else None
    risks: list[str] = []
    route_advice: list[str] = []
    if target is not None:
        goal, path = target
        name = getattr(goal, "name", "出口")
        metadata.update({"nearest_target": {"name": name, "x": goal.x, "y": goal.y}, "path": [{"x": x, "y": y} for x, y in path], "distance": len(path)})
        rests = ceil(max(0, len(path) - state.stamina) / min(4, state.max_stamina))
        route_advice = [f"{name}在{_where(goal)}，按当前空位最短需要{len(path)}步。"]
        if path:
            route_advice.append(f"先向{_toward(state, path[0])}移动到第{path[0][0] + 1}列第{path[0][1] + 1}行，消耗1点体力。")
        if rests:
            route_advice.append(f"当前体力为{state.stamina}，这段路至少还要休息{rests}次；每次恢复最多4点。")
        if len(path) + rests > state.max_turns - state.turn:
            risks.append(f"这段路连同必要恢复至少要{len(path) + rests}回合，当前只剩{state.max_turns - state.turn}回合。")
    else:
        metadata.update({"nearest_target": None, "path": None, "distance": None})
        # A guard can occupy the only opening. Follow a walls-only path up to
        # its first occupied cell, rather than treating that enemy cell as a move.
        candidates = goals or ([state.exit] if state.exit is not None else [])
        blocked_routes = [(goal, shortest_path(state, goal, avoid_enemies=False)) for goal in candidates]
        wall_reachable = [(goal, path) for goal, path in blocked_routes if path is not None]
        if wall_reachable:
            goal, path = min(wall_reachable, key=lambda item: len(item[1]))
            live_cells = {enemy.cell(): enemy for enemy in live}
            first_blocker = next(((index, live_cells[cell]) for index, cell in enumerate(path) if cell in live_cells), None)
            if first_blocker is not None:
                index, blocker = first_blocker
                approach = path[:index]
                name = getattr(goal, "name", "出口")
                route_advice = [f"通往{name}的路被{_where(blocker)}的{blocker.name}堵住，先打开这条通路。"]
                if approach:
                    step = approach[0]
                    route_advice.append(f"先向{_toward(state, step)}移动到第{step[0] + 1}列第{step[1] + 1}行，消耗1点体力，靠近堵路的{blocker.name}。")
                metadata.update({"blocked_target": {"name": name, "x": goal.x, "y": goal.y}, "blocker_id": blocker.id, "path": [{"x": x, "y": y} for x, y in approach], "distance": len(approach), "path_target_kind": "blocker-approach"})
                risks.append(f"必须先处理{blocker.name}，才能继续走向{name}。")
        if not route_advice:
            risks.append("当前目标被墙隔开，没有可达路线。")

    winning_move = target is not None and len(target[1]) == 1 and (not goals or scene == "river" and len(goals) == 1)
    healing = min(8, state.max_hp - state.hp) if state.potions else 0
    escapes = []
    occupied = {wall.cell() for wall in state.walls} | {enemy.cell() for enemy in live}
    if state.stamina > 0 and incoming >= state.hp + healing:
        for dx, dy, direction in DIRECTIONS:
            cell = state.position.x + dx, state.position.y + dy
            if 0 <= cell[0] < 9 and 0 <= cell[1] < 6 and cell not in occupied:
                damage = sum(_damage(enemy, state) for enemy in live if abs(enemy.x - cell[0]) + abs(enemy.y - cell[1]) == 1)
                if damage < state.hp:
                    escapes.append((damage, direction, cell))
    # Reaching the final destination ends the game before enemies act.
    if winning_move and state.stamina > 0:
        action = route_advice[1] + " 到达即通关，本回合敌人不再行动。"
        reason = "这是最后一个目标或出口，走到落点就完成本局。"
    elif escapes:
        damage, direction, cell = min(escapes, key=lambda candidate: candidate[0])
        action = f"先向{direction}移动到第{cell[0] + 1}列第{cell[1] + 1}行，消耗1点体力；该落点本回合承受{damage}点近身伤害。"
        reason = f"留在原地可承受{incoming}点伤害，{'喝药后也只有' + str(state.hp + healing) + '点生命' if state.potions else '当前只有' + str(state.hp) + '点生命'}；先脱离围攻。敌人追近后不会在同一回合追加攻击。"
    elif state.potions > 0 and state.hp < state.max_hp and (state.hp <= incoming or state.hp * 100 <= state.max_hp * 35):
        healed = min(8, state.max_hp - state.hp)
        action = f"先喝1瓶药水，恢复{healed}点生命至{state.hp + healed}/{state.max_hp}；剩{state.potions - 1}瓶。"
        reason = f"留在原地，身边敌人下一次行动可造成{incoming}点伤害。" if incoming else f"当前只有{state.hp}点生命，先补血再赶路。"
    elif state.stamina == 0:
        recovered = min(4, state.max_stamina)
        action = f"先休息一回合，体力从0恢复到{recovered}/{state.max_stamina}。"
        reason = "移动和普攻都消耗1点体力，技能消耗2点。"
    else:
        in_range = sorted((enemy for enemy in live if _distance(state.position, enemy) <= 2), key=lambda enemy: (_distance(state.position, enemy), enemy.hp, -enemy.attack))
        adjacent_target = in_range[0] if in_range else None
        if adjacent_target is not None and (_distance(state.position, adjacent_target) == 1 or state.stamina >= 2):
            enemy = adjacent_target
            skill = state.stamina >= 2 and (_distance(state.position, enemy) == 2 or state.attack < enemy.hp <= state.attack + 2)
            dealt = min(enemy.hp, state.attack + (2 if skill else 0))
            cost = 2 if skill else 1
            remaining = max(0, enemy.hp - dealt)
            action = f"对{_where(enemy)}的{enemy.name}使用{'技能' if skill else '普攻'}，消耗{cost}点体力，造成{dealt}点伤害，{'可直接击倒' if remaining == 0 else f'使其剩余{remaining}点生命'}。"
            reason = f"它距离你{_distance(state.position, enemy)}格；当前体力{state.stamina}，足够执行这一步。"
        elif route_advice:
            action = route_advice[1] if len(route_advice) > 1 else route_advice[0]
            reason = route_advice[0]
        else:
            action = "先观察堵路敌人的位置，沿可走格靠近并打开通路。"
            reason = "未完成目标暂时没有可达路径。"
    if incoming:
        risks.append(f"若原地不处理敌人，下一回合有{len(adjacent)}名相邻敌人可出手，按当前防御合计可造成{incoming}点伤害。")
    actions = [action, *(item for item in route_advice if item != action)][:4]
    phase = "带齐物资返回出口" if not goals and scene == "town" else "带齐符文返回出口" if not goals else f"完成场景目标（{completed}/{total}）"
    advice = [TacticalAdviceItem(title="现在这样打", recommendation=action, reasoning=reason, confidence="high")]
    if route_advice:
        advice.append(TacticalAdviceItem(title="接下来的路线", recommendation=route_advice[0], reasoning=f"路线避开墙与当前活敌人；剩余{state.max_turns - state.turn}回合，体力{state.stamina}。", confidence="high"))
    tempo = "小镇敌人只在偶数回合行动。" if scene == "town" else "敌人每回合行动；靠近后下一次才能攻击。"
    return AnalysisResponse(
        summary=f"{title} · 第{state.turn}回合：{action}",
        direction_prediction=DirectionPrediction(current_phase=phase, best_direction=action, why_now=reason, avoid_direction="不要在体力不足时硬冲；先看敌人距离再行动。", confidence="high"),
        tactical_advice=advice, beginner_explanation=f"{situation}\n{tempo} 普攻消耗1体力，技能消耗2体力且可打2格内的单个敌人。",
        risks_or_uncertainties=risks, next_steps=actions,
        review_report=_review(state, actions, situation), metadata=metadata,
    )
