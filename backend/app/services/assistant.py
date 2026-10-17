"""Evidence-bounded answers for questions, progression advice and reviews."""

from app.models.schemas import AnalysisResponse, DirectionPrediction, ReviewSection, TacticalAdviceItem


BUILD_COST_NOTICE = "未提供经过校验的升级价格，购买数量、预算可行性和最优分配尚未验证。"


def has_no_resources(state: dict) -> bool:
    resources = state.get("available_resources", {})
    return bool(resources) and all(value == 0 for value in resources.values())


def qa_draft(game: str, question: str, state: dict | None = None) -> AnalysisResponse:
    return AnalysisResponse(
        summary="尚未检索到可引用的本地知识。",
        direction_prediction=DirectionPrediction(
            current_phase="Knowledge question with supplied context" if state else "Knowledge question; no match snapshot supplied",
            best_direction="Read the cited local knowledge and provide a state for tactical advice.",
            why_now="A question alone does not establish an observed game situation.",
            avoid_direction="Do not infer a match state from an example.",
            confidence="low",
        ),
        tactical_advice=[],
        beginner_explanation="本地知识包用于演示通用原则，不保证覆盖当前游戏版本的具体机制。",
        risks_or_uncertainties=["问答模式只解释检索命中的通用知识，不据此确认具体失误。"],
        next_steps=["查看来源；需要局势建议时提供结构化状态。"],
        review_report=ReviewSection(
            current_situation="Structured context supplied for a knowledge question." if state else "No match state supplied.", likely_mistakes=[],
            recommended_actions=[], longer_term_improvement=[],
        ),
        metadata={"game": game, "question": question},
    )


def compose_answer(task: str, state: dict, response: AnalysisResponse, profile=None, max_steps: int = 4) -> str:
    sources = response.metadata.get("knowledge_matches", [])
    if task == "qa":
        if not sources:
            return "本地知识库没有找到与问题匹配的证据，暂时无法可靠回答。请补充游戏术语、具体状态，或扩充知识包。"
        lines = ["根据本地演示知识库："]
        for index, source in enumerate(sources[:3], 1):
            lines.append(f"[{index}] {source['content']}\n来源：{source['source']} · {source['path']}")
        if response.metadata.get("llm_status") == "enhanced":
            lines.append(f"模型补充（请结合来源核对）：{response.summary}")
        lines.append("这些条目支持通用原则；未覆盖的问题与具体版本机制仍需补充证据。")
        return "\n\n".join(lines)

    if task == "build":
        resources = state.get("available_resources", {})
        budget = "、".join(f"{key}={value}" for key, value in resources.items()) or "未提供"
        stats = state.get("core_stats", {})
        model_summary = response.summary
        enhanced = response.metadata.get("llm_status") == "enhanced"
        model_steps = list(dict.fromkeys(step.strip() for step in response.next_steps if step.strip()))
        if has_no_resources(state):
            steps = [
                "当前可用资源为零；先通过已有内容获取资源，暂不购买或强化装备。",
                "核对已有装备、升级材料需求和升级价格，整理可选方案。",
                "记录目标关卡的续航与生存瓶颈，待获得资源后重新规划。",
            ]
            origin = "resource_guard"
        elif enhanced and model_steps:
            steps = model_steps
            origin = "llm"
        else:
            steps = []
            if stats.get("mana_regen", 100) <= 18:
                steps.append("先解决续航：对比可获得的回蓝装备，再测试是否能稳定完成目标阶段。")
            if stats.get("vitality", 100) <= 26:
                steps.append("再解决生存：优先检查最低效的防具或生命属性，记录容错是否改善。")
            steps.append(f"围绕 {state.get('build_focus', response.direction_prediction.best_direction)} 集中投入，暂缓无关属性。")
            origin = "local"
        steps = steps[:max_steps]
        response.next_steps = steps
        response.metadata["build_plan_origin"] = origin
        if origin == "resource_guard":
            # Training exports include the entire response. Constrain all
            # actionable fields, not only the displayed next_steps list.
            _constrain_zero_resource_build(response, state, steps)
        if BUILD_COST_NOTICE not in response.risks_or_uncertainties:
            response.risks_or_uncertainties.append(BUILD_COST_NOTICE)
        goal = state.get("current_goal", "用户指定目标")
        extra = f"\n个人目标：{profile.goals[0]}。" if profile and profile.goals else ""
        analysis = f"\n\n模型分析（升级成本尚未核验）：\n{model_summary}" if origin == "llm" else ""
        return f"养成目标：{goal}\n资源约束：{budget}。{BUILD_COST_NOTICE}{extra}{analysis}\n\n行动建议：\n" + "\n".join(f"{i}. {step}" for i, step in enumerate(steps, 1))

    observations = []
    for key in ("game_time_minutes", "team_gold_diff", "recent_deaths", "current_problem", "pain_point"):
        if key in state:
            observations.append(f"{key}={state[key]}")
    events = state.get("recent_events", state.get("notes", []))
    if isinstance(events, list):
        observations.extend(str(event) for event in events[:5])
    evidence = "；".join(observations) or response.review_report.current_situation
    return (
        f"输入依据：{evidence}\n\n"
        "待核查的可能问题（单个快照不能确认因果）：\n"
        + "\n".join(f"- {item}" for item in response.review_report.likely_mistakes)
        + "\n\n复盘行动：\n"
        + "\n".join(f"{i}. {item}" for i, item in enumerate(response.review_report.recommended_actions, 1))
        + "\n\n建议回看对应时间段的录像，核对走位、视野和资源变化后再确定失误。"
    )


def _constrain_zero_resource_build(response: AnalysisResponse, state: dict, steps: list[str]) -> None:
    response.direction_prediction = DirectionPrediction(
        current_phase="Resource collection before upgrades",
        best_direction="Collect resources and verify upgrade requirements before spending.",
        why_now="All supplied available resources are zero.",
        avoid_direction="Do not buy, upgrade or respec using unavailable resources.",
        confidence="high",
    )
    response.tactical_advice = [TacticalAdviceItem(
        title="先获取资源与核对成本", recommendation=steps[0],
        reasoning="已提供的可用资源全部为零，且尚未核验任何升级价格。", confidence="high",
    )]
    response.beginner_explanation = "先确认资源和成本，再决定升级；当前只提供资源获取、信息核对和复盘记录等无成本行动。"
    response.risks_or_uncertainties = [BUILD_COST_NOTICE]
    response.review_report = ReviewSection(
        current_situation=f"{state.get('character_name', '角色')} 当前目标为 {state.get('current_goal', '指定内容')}，可用资源全部为零。",
        likely_mistakes=[], recommended_actions=steps,
        longer_term_improvement=["记录目标内容的失败模式与候选升级成本，获得资源后再比较方案。"],
    )
