"""Execute one request under a pinned policy and persist an auditable trace."""

from time import perf_counter
from uuid import uuid4

from app.models.schemas import AnalysisResponse, AssistantResponse, SupportedGame, UserProfile
from app.services import ops
from app.services.assistant import compose_answer, has_no_resources, qa_draft
from app.services.game_packs import analyze_game, build_json_perception, build_screenshot_perception
from app.services.mongo_store import mongo_store
from app.services.openrouter_client import maybe_enhance_analysis
from app.services.runtime import current_policy, current_player_memory
from app.services.player_memory import attach_memory, capture_memory, resolve_memory
from app.services.retrieval import retrieval_query
from app.services.state_validation import validate_state


class GameBuddyOrchestrator:
    def analyze_state(
        self, game: SupportedGame, state: dict, question: str,
        user_profile: UserProfile | None = None, session_id: str | None = None,
        *, policy_id: str | None = None, persist: bool = True, record_trace: bool = True,
    ) -> AnalysisResponse:
        validate_state(game, state)
        return self._run(game, state, question, user_profile, session_id,
                         policy_id=policy_id, persist=persist, record_trace=record_trace)

    async def analyze_screenshot(
        self, game: SupportedGame, filename: str | None, question: str,
        user_profile: UserProfile | None = None, session_id: str | None = None,
    ) -> AnalysisResponse:
        return self._run(game, {}, question, user_profile, session_id, filename=filename, screenshot=True)

    def assistant(
        self, game: SupportedGame, task: str, state: dict, question: str,
        user_profile: UserProfile | None = None, session_id: str | None = None,
        *, policy_id: str | None = None, persist: bool = True, record_trace: bool = True,
    ) -> AssistantResponse:
        if task == "build" and game != "rpg-build-demo":
            raise ValueError("build currently supports rpg-build-demo")
        if state or task != "qa":
            validate_state(game, state)
        response = self._run(game, state, question, user_profile, session_id, task=task,
                             policy_id=policy_id, persist=persist, record_trace=record_trace)
        sources = response.metadata.get("knowledge_matches", [])
        return AssistantResponse(
            answer=response.summary, sources=sources, analysis=response,
            evidence_status="grounded" if sources else "insufficient",
            trace_id=response.metadata["trace_id"],
        )

    def _run(
        self, game, state, question, user_profile, session_id,
        *, task="analysis", policy_id=None, filename=None, screenshot=False,
        persist=True, record_trace=True,
    ):
        started = perf_counter()
        policy = ops.get_policy(policy_id)
        token = current_policy.set(policy)
        memory_token = current_player_memory.set(None)
        trace = {
            "id": uuid4().hex, "created_at": ops.now(), "game": game, "task": task,
            "question": question, "policy_id": policy["id"], "session_id": session_id,
            "policy_snapshot": {key: policy[key] for key in ("id", "prompt", "instructions", "max_next_steps")},
            "user_profile": None, "state": state, "steps": [], "status": "success",
        }

        def step(name, began, data):
            trace["steps"].append({"name": name, "duration_ms": round((perf_counter() - began) * 1000, 3), "data": data})

        try:
            began = perf_counter()
            perception = build_screenshot_perception(game, filename) if screenshot else build_json_perception(game, state)
            trace["state"] = perception.extracted_state
            step("perception", began, {"source": perception.source, "notes": perception.perception_notes})
            began = perf_counter()
            base_profile = (mongo_store.merge_user_profile(user_profile) or user_profile) if persist else user_profile
            memory = None
            resolved = base_profile
            if persist and base_profile and base_profile.user_id:
                resolved, memory = resolve_memory(base_profile, game, retrieval_query(question, perception.extracted_state))
                current_player_memory.set(memory)
            trace["user_profile"] = resolved.model_dump() if resolved else None
            step("profile", began, {"user_id": resolved.user_id if resolved else None, "loaded": resolved is not None})
            if memory is not None:
                step("memory", began, memory)
            began = perf_counter()
            if task == "qa":
                response = maybe_enhance_analysis(
                    game=game, question=question, extracted_state=state, heuristic=qa_draft(game, question, state),
                    user_profile=resolved, session_id=session_id, question_only_retrieval=True,
                    task=task,
                )
            else:
                response = analyze_game(
                    perception, question, user_profile=resolved, session_id=session_id, task=task,
                    allow_llm=not (task == "build" and has_no_resources(state)),
                )
            step("analysis", began, {"llm_status": response.metadata.get("llm_status", "disabled")})
            trace["steps"].append({
                "name": "retrieval", "duration_ms": response.metadata.get("retrieval_duration_ms", 0),
                "data": {"sources": response.metadata.get("knowledge_matches", [])},
            })
            trace["steps"].append({
                "name": "llm", "duration_ms": response.metadata.get("llm_duration_ms", 0),
                "data": {key: response.metadata.get(key) for key in ("llm_status", "fallback_reason", "llm_model", "tool_trace")},
            })
            if task != "analysis":
                response.summary = compose_answer(task, state, response, resolved, policy["max_next_steps"])
            response.next_steps = response.next_steps[:policy["max_next_steps"]]
            if resolved and resolved.preferred_style == "concise":
                response.next_steps = response.next_steps[:3]
            response.metadata.update({"trace_id": trace["id"], "policy_id": policy["id"], "task": task})
            if memory is not None:
                attach_memory(response, memory)
            if persist:
                began = perf_counter()
                # Don't write a loaded or game-scoped profile back on ID-only requests.
                if user_profile and user_profile.model_fields_set - {"user_id"}:
                    mongo_store.upsert_user_profile(base_profile)
                saved = capture_memory(question, base_profile, game, trace["id"]) if task == "qa" else None
                if saved:
                    response.metadata["memory"]["saved"] = saved
                    response.summary = f"已记下：{saved['content']}"
                mongo_store.save_analysis_history(
                    game=game, question=question, session_id=session_id, user_profile=resolved,
                    extracted_state=perception.extracted_state, response=response, source=perception.source,
                )
                step("persistence", began, {"storage": "local-first"})
            trace["response"] = response.model_dump()
            trace["status"] = "fallback" if response.metadata.get("llm_status") == "fallback" else "success"
            return response
        except Exception as exc:
            trace["status"] = "error"
            trace["error"] = type(exc).__name__
            raise
        finally:
            current_policy.reset(token)
            current_player_memory.reset(memory_token)
            trace["latency_ms"] = round((perf_counter() - started) * 1000, 3)
            if record_trace:
                ops.save_trace(trace)
