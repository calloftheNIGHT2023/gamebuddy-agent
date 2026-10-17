"""Deterministic offline contract checks, not a measure of gameplay quality."""

import json
from pathlib import Path
from uuid import uuid4

from app.models.schemas import UserProfile
from app.services import ops
from app.services.local_store import local_store
from app.services.runtime import offline_mode
from app.services.state_validation import validate_state


def run_evaluation(policy_id: str | None = None, *, persist: bool = True) -> dict:
    from app.services.orchestrator import GameBuddyOrchestrator
    from app.services.retrieval import retrieve_knowledge

    policy = ops.get_policy(policy_id)
    runner = GameBuddyOrchestrator()
    root = Path(__file__).resolve().parents[3] / "samples" / "game-states"
    checks = []

    def check(name, func):
        try:
            passed, detail = func()
            checks.append({"name": name, "passed": bool(passed), "detail": detail})
        except Exception as exc:
            checks.append({"name": name, "passed": False, "detail": type(exc).__name__})

    def load(filename):
        return json.loads((root / filename).read_text(encoding="utf-8"))

    def analyze(game, filename, expected):
        result = runner.analyze_state(game, load(filename), "Review the next decision", policy_id=policy["id"], persist=False, record_trace=False)
        return (
            expected.lower() in result.direction_prediction.best_direction.lower()
            and result.metadata["policy_id"] == policy["id"]
            and result.metadata.get("llm_status") == "disabled",
            f"direction contains '{expected}', pinned policy and external model disabled",
        )

    token = offline_mode.set(True)
    try:
        check("pokemon preserves chipped closer", lambda: analyze("pokemon-battle-demo", "balanced-position.json", "low-risk pivot"))
        check("moba objective setup", lambda: analyze("moba-postmatch-demo", "moba-comeback-window.json", "dragon"))
        check("rpg sustain bottleneck", lambda: analyze("rpg-build-demo", "rpg-mage-build.json", "mana"))
        check("Chinese retrieval", lambda: (bool(retrieve_knowledge("moba-postmatch-demo", "视野与目标物准备")), "Chinese query retrieves local sources"))
        check("uncovered query abstains", lambda: (not retrieve_knowledge("moba-postmatch-demo", "quantum-zxqv-unicorn"), "No arbitrary fallback document"))

        def qa():
            response = runner.assistant("moba-postmatch-demo", "qa", {}, "What is face-check?", policy_id=policy["id"], persist=False, record_trace=False)
            return bool(response.sources) and response.sources[0]["content"] in response.answer, "Answer quotes a retrieved source with a stable path"

        check("question answer grounding", qa)

        def abstain():
            response = runner.assistant("moba-postmatch-demo", "qa", {}, "quantum-zxqv-unicorn", policy_id=policy["id"], persist=False, record_trace=False)
            return response.evidence_status == "insufficient" and not response.sources, "No match state invented for an unknown question"

        check("question answer insufficient evidence", abstain)

        def build():
            state = load("rpg-mage-build.json")
            state["available_resources"] = {"gold": 0, "upgrade_stones": 0}
            response = runner.assistant("rpg-build-demo", "build", state, "如何升级？", policy_id=policy["id"], persist=False, record_trace=False)
            return "资源为零" in response.answer and "升级价格" in response.answer, "Zero resources and missing prices constrain the upgrade advice"

        check("progression resource constraint", build)

        def review():
            state = load("moba-comeback-window.json")
            state["recent_events"] = ["At 23:40 I entered river without vision."]
            response = runner.assistant("moba-postmatch-demo", "review", state, "复盘", policy_id=policy["id"], persist=False, record_trace=False)
            return state["recent_events"][0] in response.answer and "不能确认因果" in response.answer, "Review cites a supplied event and labels causal uncertainty"

        check("review event provenance", review)

        def policy_budget():
            response = runner.analyze_state("moba-postmatch-demo", load("moba-comeback-window.json"), "Review setup", policy_id=policy["id"], persist=False, record_trace=False)
            return len(response.next_steps) <= policy["max_next_steps"], "The selected policy constrains the local output"

        check("local policy effect", policy_budget)

        def personalization():
            result = runner.analyze_state("moba-postmatch-demo", load("moba-comeback-window.json"), "Review setup", UserProfile(user_id="eval-only", skill_level="beginner"), policy_id=policy["id"], persist=False, record_trace=False)
            return "safest repeatable habit" in result.beginner_explanation, "Profile changes the offline explanation"

        check("local personalization", personalization)

        def invalid():
            state = load("rpg-mage-build.json")
            state["core_stats"]["mana_regen"] = "invalid"
            try:
                validate_state("rpg-build-demo", state)
            except ValueError:
                return True, "A malformed consumed numeric field is rejected"
            return False, "Invalid state accepted"

        check("invalid input rejection", invalid)
    finally:
        offline_mode.reset(token)
    report = {
        "id": uuid4().hex, "created_at": ops.now(), "policy_id": policy["id"],
        "policy_snapshot": {key: policy[key] for key in ("id", "prompt", "instructions", "max_next_steps")},
        "passed": sum(item["passed"] for item in checks), "total": len(checks), "checks": checks,
        "scope": "Offline deterministic contract checks; no gameplay accuracy, human preference or external provider quality claims.",
    }
    if persist:
        local_store.put("evaluations", report["id"], report)
    return report
