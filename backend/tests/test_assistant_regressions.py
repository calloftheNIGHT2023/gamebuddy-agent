"""Regressions across provider -> assistant -> trace -> reviewed data export."""

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import openrouter_client as llm
from app.services.assistant import BUILD_COST_NOTICE, compose_answer, qa_draft


client = TestClient(app)
HTTP_CLIENT = httpx.Client
RPG = "rpg-build-demo"
MOBA = "moba-postmatch-demo"
MODEL_SUMMARY = "先通过已有装备对比测试续航，再决定后续投入方向。"
MODEL_STEPS = ["记录现有装备的回蓝差异。", "比较两个已有防具的容错表现。", "根据测试结果集中投入。"]
TOOL_ONLY_QUESTION = "如何避免进入没有侦察信息的区域？"


def rpg_state():
    path = Path(__file__).resolve().parents[2] / "samples/game-states/rpg-mage-build.json"
    return json.loads(path.read_text(encoding="utf-8"))


def model_content(game=RPG):
    response = qa_draft(game, "test")
    content = response.model_dump(exclude={"metadata"})
    content.update({
        "summary": MODEL_SUMMARY,
        "next_steps": MODEL_STEPS,
        "tactical_advice": [{
            "title": "Compare existing equipment", "recommendation": MODEL_STEPS[0],
            "reasoning": "Compare observed sustain before committing resources.", "confidence": "medium",
        }],
    })
    return content


def provider(monkeypatch, messages):
    requests = []
    responses = iter(messages)

    def handle(request):
        requests.append(json.loads(request.content))
        message = next(responses)
        if isinstance(message, Exception):
            raise message
        return httpx.Response(200, json={"choices": [{"message": message}]})

    monkeypatch.setattr(llm.settings, "openrouter_api_key", "mock-key-never-sent")
    monkeypatch.setattr(llm.httpx, "Client", lambda **kwargs: HTTP_CLIENT(transport=httpx.MockTransport(handle), **kwargs))
    return requests


def answer(content):
    return {"role": "assistant", "content": json.dumps(content)}


def knowledge_call(topic="face-check", identifier="knowledge-1"):
    return {"id": identifier, "type": "function", "function": {
        "name": "get_game_knowledge", "arguments": json.dumps({"game": MOBA, "topic": topic}),
    }}


@pytest.mark.parametrize("max_steps", [1, 2])
def test_enhanced_build_reaches_display_trace_and_sft(monkeypatch, max_steps):
    requests = provider(monkeypatch, [answer(model_content())])
    policy = client.post("/api/v1/ops/policies", json={
        "name": "Short build", "prompt": "Explain priorities", "max_next_steps": max_steps,
    }).json()
    state = rpg_state()
    state["prices"] = {"unvalidated_upgrade": 1}
    response = client.post("/api/v1/assistant", json={
        "game": RPG, "task": "build", "question": "优先使用现有装备改善续航。", "state": state, "policy_id": policy["id"],
    })
    assert response.status_code == 200, response.text
    body = response.json()
    analysis = body["analysis"]
    assert MODEL_SUMMARY in body["answer"]
    assert analysis["next_steps"] == MODEL_STEPS[:max_steps]
    assert all(step in body["answer"] for step in MODEL_STEPS[:max_steps])
    assert all(step not in body["answer"] for step in MODEL_STEPS[max_steps:])
    assert BUILD_COST_NOTICE in body["answer"]
    assert BUILD_COST_NOTICE in analysis["risks_or_uncertainties"]
    assert analysis["metadata"]["build_plan_origin"] == "llm"
    assert analysis["metadata"]["llm_status"] == "enhanced"
    assert "Task: build" in requests[0]["messages"][1]["content"]
    assert "优先使用现有装备改善续航" in requests[0]["messages"][1]["content"]
    trace = client.get(f"/api/v1/ops/traces/{body['trace_id']}").json()
    assert trace["response"] == analysis
    assert client.post(f"/api/v1/ops/traces/{body['trace_id']}/feedback", json={"rating": "up"}).status_code == 200
    exported = client.get("/api/v1/memory/training-samples.jsonl?sample_type=sft")
    sample = json.loads(exported.text.strip())
    assert sample["metadata"]["trace_verified"]
    assert sample["prompt"]["task"] == "build"
    assert sample["target"] == analysis


def test_zero_budget_avoids_provider_and_keeps_entire_training_target_consistent(monkeypatch):
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "mock-key-never-sent")
    monkeypatch.setattr(llm.httpx, "Client", lambda **kwargs: pytest.fail("Zero-budget planning called the provider"))
    state = rpg_state()
    state["available_resources"] = {key: 0 for key in state["available_resources"]}
    response = client.post("/api/v1/assistant", json={"game": RPG, "task": "build", "question": "现在能买什么？", "state": state})
    assert response.status_code == 200, response.text
    body = response.json()
    analysis = body["analysis"]
    assert "资源为零" in body["answer"]
    assert BUILD_COST_NOTICE in body["answer"]
    assert analysis["metadata"]["llm_status"] == "disabled"
    assert analysis["metadata"]["llm_disabled_reason"] == "request_constraint"
    assert analysis["metadata"]["build_plan_origin"] == "resource_guard"
    assert analysis["next_steps"] == analysis["review_report"]["recommended_actions"]
    assert analysis["tactical_advice"][0]["recommendation"] == analysis["next_steps"][0]
    assert client.post(f"/api/v1/ops/traces/{body['trace_id']}/feedback", json={"rating": "up"}).status_code == 200
    record = json.loads(client.get("/api/v1/memory/training-samples.jsonl?sample_type=sft").text.strip())
    assert record["target"] == analysis
    assert "Upgrade or replace" not in json.dumps(record["target"], ensure_ascii=False)
    assert "升级成本尚未核验" not in record["target"]["summary"]  # No model draft rendered.


def test_renderer_cannot_leave_rejected_model_plan_in_other_zero_budget_fields():
    from app.models.schemas import AnalysisResponse

    content = model_content()
    marker = "BUY_EXPENSIVE_GEAR_NOW"
    content["summary"] = marker
    content["next_steps"] = [marker]
    content["beginner_explanation"] = marker
    content["tactical_advice"][0]["recommendation"] = marker
    content["review_report"]["recommended_actions"] = [marker]
    content["review_report"]["longer_term_improvement"] = [marker]
    content["direction_prediction"]["best_direction"] = marker
    content["risks_or_uncertainties"] = [marker]
    response = AnalysisResponse(**content, metadata={"llm_status": "enhanced"})
    state = rpg_state()
    state["available_resources"] = {"gold": 0}
    response.summary = compose_answer("build", state, response, max_steps=1)
    assert marker not in response.model_dump_json()
    assert len(response.next_steps) == 1


@pytest.mark.parametrize("final", ["enhanced", "timeout", "invalid_schema"])
def test_tool_only_evidence_reaches_qa_sources_trace_and_final_answer(monkeypatch, final):
    terminal = answer(model_content(MOBA))
    if final == "timeout":
        terminal = httpx.ReadTimeout("simulated provider failure")
    elif final == "invalid_schema":
        terminal = {"role": "assistant", "content": "{}"}
    requests = provider(monkeypatch, [
        {"role": "assistant", "tool_calls": [knowledge_call(), knowledge_call(identifier="knowledge-2")]},
        terminal,
    ])
    response = client.post("/api/v1/assistant", json={"game": MOBA, "task": "qa", "question": TOOL_ONLY_QUESTION})
    assert response.status_code == 200, response.text
    body = response.json()
    metadata = body["analysis"]["metadata"]
    assert metadata["initial_retrieval_status"] == "no_match"
    assert metadata["initial_knowledge_matches"] == []
    assert metadata["retrieval_status"] == "matched"
    assert metadata["llm_status"] == ("enhanced" if final == "enhanced" else "fallback")
    assert body["evidence_status"] == "grounded"
    assert body["sources"]
    identities = [(source["source"], source["path"]) for source in body["sources"]]
    assert len(identities) == len(set(identities))
    assert body["sources"][0]["content"] in body["answer"]
    assert "暂时无法可靠回答" not in body["answer"]
    assert len(requests) == 2
    trace = client.get(f"/api/v1/ops/traces/{body['trace_id']}").json()
    retrieval = next(step for step in trace["steps"] if step["name"] == "retrieval")
    assert retrieval["data"]["sources"] == body["sources"]
    assert trace["response"] == body["analysis"]


def test_failed_knowledge_tool_does_not_upgrade_qa_evidence_status(monkeypatch):
    bad_call = knowledge_call()
    bad_call["function"]["arguments"] = json.dumps({"game": RPG, "topic": "mana"})
    provider(monkeypatch, [{"tool_calls": [bad_call]}, answer(model_content(MOBA))])
    body = client.post("/api/v1/assistant", json={"game": MOBA, "question": "quantum-zxqv-unicorn"}).json()
    assert body["evidence_status"] == "insufficient"
    assert body["sources"] == []
    assert "暂时无法可靠回答" in body["answer"]
