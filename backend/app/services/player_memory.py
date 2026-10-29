"""Scoped, bounded memory retrieval with explicit writes and real expiry/deletion."""

from __future__ import annotations

import math
import re
from contextlib import closing
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import uuid4

from app.models.player_memory import MemoryInput, PlayerMemory
from app.models.schemas import UserProfile
from app.services.local_store import LocalStore, local_store
from app.services.retrieval import _terms
from app.services.runtime import public_request


def now() -> str:
    return datetime.now(UTC).isoformat()


class MemoryConflict(ValueError):
    pass


def relevance(query: str, text: str) -> float:
    terms, document = _terms(query[:2000]), _terms(text[:2000])
    common = terms.keys() & document.keys()
    return sum(2 if term.startswith("concept:") else 1 for term in common) / math.sqrt(max(1, sum(document.values())))


class PlayerMemoryStore:
    def __init__(self, store: LocalStore = local_store):
        self.store = store

    def _connect(self):
        connection = self.store._connect()
        connection.execute("CREATE TABLE IF NOT EXISTS player_memories ("
                           "id TEXT PRIMARY KEY, user_id TEXT NOT NULL, scope TEXT NOT NULL, kind TEXT NOT NULL, "
                           "memory_key TEXT NOT NULL, payload TEXT NOT NULL, expires_at TEXT, "
                           "UNIQUE(user_id, scope, kind, memory_key))")
        connection.execute("CREATE INDEX IF NOT EXISTS player_memory_owner ON player_memories(user_id, scope)")
        connection.execute("CREATE TABLE IF NOT EXISTS forgotten_game_runs (user_id TEXT, scope TEXT, memory_key TEXT, expires_at TEXT, PRIMARY KEY(user_id, scope, memory_key))")
        return connection

    def list(self, user_id: str, game: str | None = None) -> list[PlayerMemory]:
        with closing(self._connect()) as connection, connection:
            # Expired content is removed, rather than only hidden from the UI.
            connection.execute("DELETE FROM player_memories WHERE user_id = ? AND expires_at <= ?", (user_id, now()))
            sql = "SELECT payload FROM player_memories WHERE user_id = ?"
            args = [user_id]
            if game:
                sql += " AND scope IN ('', ?)"
                args.append(game)
            rows = connection.execute(sql + " ORDER BY id LIMIT 200", args).fetchall()
        return sorted((PlayerMemory.model_validate_json(row[0]) for row in rows), key=lambda item: item.updated_at, reverse=True)

    def put(self, user_id: str, value: MemoryInput, expected_revision: int | None = 0,
            *, source: str = "user", source_id: str | None = None, expected_id: str | None = None) -> PlayerMemory:
        with closing(self._connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            timestamp = now()
            connection.execute("DELETE FROM forgotten_game_runs WHERE expires_at <= ?", (timestamp,))
            if source == "game" and connection.execute("SELECT 1 FROM forgotten_game_runs WHERE user_id=? AND scope=? AND memory_key=?", (user_id, value.game or "", value.key)).fetchone():
                raise MemoryConflict("这局记录已被删除。")
            connection.execute("DELETE FROM player_memories WHERE user_id = ? AND expires_at <= ?", (user_id, timestamp))
            row = connection.execute("SELECT payload FROM player_memories WHERE user_id=? AND scope=? AND kind=? AND memory_key=?",
                                     (user_id, value.game or "", value.kind, value.key)).fetchone()
            previous = PlayerMemory.model_validate_json(row[0]) if row else None
            if expected_id is not None and (previous is None or previous.id != expected_id):
                raise KeyError("记忆不存在或已经被替换。")
            revision = previous.revision if previous else 0
            if expected_revision is not None and expected_revision != revision:
                raise MemoryConflict("记忆已更新，请刷新后再保存。")
            count = connection.execute("SELECT COUNT(*) FROM player_memories WHERE user_id=?", (user_id,)).fetchone()[0]
            if previous is None and count >= 200:
                raise MemoryConflict("已达到 200 条记忆，请先整理旧记录。")
            expiry = (datetime.fromisoformat(timestamp) + timedelta(days=value.ttl_days)).isoformat() if value.ttl_days else None
            if previous and previous.content == value.content and (source == "game" or (source == "explicit_request" and previous.expires_at == expiry)):
                return previous
            item = PlayerMemory(
                id=previous.id if previous else uuid4().hex, user_id=user_id, game=value.game, kind=value.kind,
                key=value.key, content=value.content, revision=revision + 1, source=source, source_id=source_id,
                created_at=previous.created_at if previous else timestamp, updated_at=timestamp, expires_at=expiry,
            )
            connection.execute("INSERT INTO player_memories VALUES (?, ?, ?, ?, ?, ?, ?) "
                               "ON CONFLICT(user_id, scope, kind, memory_key) DO UPDATE SET payload=excluded.payload, expires_at=excluded.expires_at",
                               (item.id, user_id, value.game or "", value.kind, value.key, item.model_dump_json(), expiry))
            return item

    def edit(self, user_id: str, memory_id: str, content: str, ttl_days: int | None, revision: int) -> PlayerMemory:
        item = next((item for item in self.list(user_id) if item.id == memory_id), None)
        if item is None:
            raise KeyError("记忆不存在或已过期。")
        return self.put(user_id, MemoryInput(game=item.game, kind=item.kind, key=item.key, content=content, ttl_days=ttl_days), revision, expected_id=memory_id)

    def delete(self, user_id: str, memory_id: str, revision: int) -> None:
        with closing(self._connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT payload FROM player_memories WHERE user_id=? AND id=?", (user_id, memory_id)).fetchone()
            if not row:
                raise KeyError("记忆不存在。")
            if PlayerMemory.model_validate_json(row[0]).revision != revision:
                raise MemoryConflict("记忆已更新，请刷新后再删除。")
            item = PlayerMemory.model_validate_json(row[0])
            if item.kind == "episode":
                expiry = (datetime.now(UTC) + timedelta(days=30)).isoformat()
                connection.execute("INSERT OR REPLACE INTO forgotten_game_runs VALUES (?, ?, ?, ?)", (user_id, item.game or "", item.key, expiry))
            connection.execute("DELETE FROM player_memories WHERE user_id=? AND id=?", (user_id, memory_id))

    def recall(self, user_id: str, game: str, query: str) -> list[dict]:
        # Game-specific values override global values for the same kind/key.
        active = {}
        for item in sorted(self.list(user_id, game), key=lambda value: (value.game is not None, value.updated_at)):
            active[(item.kind, item.key)] = item
        ranked = []
        for item in active.values():
            if item.kind == "episode":
                continue
            score = relevance(query, item.content)
            if item.kind != "goal" and score <= 0:
                continue
            age = max(0, (datetime.now(UTC) - datetime.fromisoformat(item.updated_at)).total_seconds() / 86400)
            score += 0.1 / (1 + age / 30)
            ranked.append({**item.model_dump(mode="json"), "score": round(score, 4),
                           "reason": "当前目标" if item.kind == "goal" else "与当前问题相关"})
        return sorted(ranked, key=lambda item: (-item["score"], item["id"]))[:4]


player_memory = PlayerMemoryStore()


def resolve_memory(profile: UserProfile | None, game: str, question: str, *, exclude_memory_key: str | None = None) -> tuple[UserProfile | None, dict]:
    """Retrieve only for the explicitly selected private player, across sessions."""
    empty = {"items": [], "episodes": [], "profile_fields": {}}
    if public_request.get() or not profile or not profile.user_id:
        return profile, empty
    from app.services.mongo_store import mongo_store

    items = player_memory.recall(profile.user_id, game, question)
    history = mongo_store._local.find("analysis_history", {"user_id": profile.user_id, "game": game}, limit=100)
    episodes = []
    for item in player_memory.list(profile.user_id, game):
        score = relevance(question, item.content)
        if item.kind == "episode" and item.key != exclude_memory_key and score > 0:
            episodes.append({"id": item.id, "created_at": item.created_at, "content": item.content, "score": score, "source": item.source})
    for document in history:
        old_question = document.get("question", "")
        if explicit_note(old_question) is not None:
            continue
        # Recall user-supplied events, never a model's inferred mistake as a fact.
        events = document.get("extracted_state", {}).get("recent_events", [])
        if not isinstance(events, list) or not events:
            continue
        observation = "；".join(str(event)[:140] for event in events[:2])[:280]
        score = relevance(question, old_question + " " + observation)
        if score > 0:
            episodes.append({"id": document.get("record_id"), "created_at": document["created_at"],
                             "content": observation, "score": round(score, 4), "source": "past_user_events"})
    episodes = sorted(episodes, key=lambda item: (item["score"], item["created_at"]), reverse=True)[:2]
    # A hard context budget is independent of how much history the player has.
    remaining, selected = 1400, []
    for item in items:
        if len(item["content"]) <= remaining:
            selected.append(item)
            remaining -= len(item["content"])
    selected_episodes = []
    for episode in episodes:
        if len(episode["content"]) <= remaining:
            selected_episodes.append(episode)
            remaining -= len(episode["content"])
    episodes = selected_episodes
    goals = [item["content"] for item in selected if item["kind"] == "goal"]
    resolved = profile.model_copy(deep=True)
    if goals:
        resolved.goals = list(dict.fromkeys([*goals, *resolved.goals]))[:5]
    fields = {key: value for key, value in resolved.model_dump().items() if key != "user_id" and value not in (None, [], "")}
    return resolved, {"items": selected, "episodes": episodes, "profile_fields": fields}


def explicit_note(question: str) -> str | None:
    match = re.fullmatch(r"(?:记住|remember)\s*[:：]\s*([^\n]{1,300})", question.strip(), re.IGNORECASE)
    return match.group(1).strip() if match and match.group(1).strip() else None


def capture_memory(question: str, profile: UserProfile | None, game: str, trace_id: str) -> dict | None:
    content = explicit_note(question)
    if public_request.get() or content is None or not profile or not profile.user_id:
        return None
    from app.services.mongo_store import mongo_store

    # Only an explicit request with an exact supported phrase changes a profile.
    changes = {}
    for pattern, field, value in [
        (r"(?:以后)?(?:请)?(?:回答|回复)(?:尽量)?(?:简短|简洁)(?:一点)?[。！!]?", "preferred_style", "concise"),
        (r"(?:以后)?(?:请)?(?:回答|回复)(?:尽量)?详细(?:一点)?[。！!]?", "preferred_style", "detailed"),
    ]:
        if re.fullmatch(pattern, content):
            changes[field] = value
    role = re.fullmatch(r"我(?:主要玩|主玩|常玩|的定位是)(辅助|打野|中单|上单|射手)[。！!]?", content)
    if role:
        changes["favorite_role"] = role.group(1)
    if changes:
        updated = mongo_store.merge_user_profile(UserProfile(user_id=profile.user_id, **changes))
        mongo_store.upsert_user_profile(updated)
        return {"profile_fields": changes, "content": content}
    goal = re.fullmatch(r"我的目标(?:是|改成|改为)(.+)", content)
    item = player_memory.put(profile.user_id, MemoryInput(
        game=game, kind="goal" if goal else "note", key="current_goal" if goal else "note-" + sha256(content.encode()).hexdigest()[:20],
        content=goal.group(1).rstrip("。") if goal else content,
    ), expected_revision=None, source="explicit_request", source_id=trace_id)
    return {"id": item.id, "revision": item.revision, "content": item.content}


def attach_memory(response, context: dict) -> None:
    response.metadata["memory"] = context
    reminders = [*context["profile_fields"].get("notes", []), *[item["content"] for item in context["items"] if item["kind"] != "goal"]]
    for goal in context["profile_fields"].get("goals", [])[:2]:
        response.review_report.longer_term_improvement.append(f"当前练习目标：{goal}")
    for reminder in reminders[:2]:
        response.review_report.longer_term_improvement.append(f"你之前记下的提醒：{reminder}")
    for episode in context["episodes"]:
        response.review_report.longer_term_improvement.append(f"回看 {episode['created_at'][:10]} 的记录：{episode['content']}")


def game_memory_key(state, run_id: str | None) -> str:
    identity = run_id or sha256(state.model_dump_json().encode()).hexdigest()[:24]
    return "run-" + sha256(identity.encode()).hexdigest()[:24]


def remember_game(user_id: str, scene: str, state, run_id: str | None, trace_id: str) -> PlayerMemory | None:
    """Remember a reviewed finished run as an episode, never as a personality trait."""
    if state.status == "playing" or public_request.get():
        return None
    completed = sum(goal.done for goal in state.objectives)
    events = "；".join(event.text for event in state.events[-2:])[:150]
    content = f"{'通关' if state.status == 'won' else '结束'}，{state.turn}回合完成{completed}/{len(state.objectives)}个目标，剩余生命{state.hp}、体力{state.stamina}、药水{state.potions}。{events}"
    try:
        return player_memory.put(user_id, MemoryInput(game=scene, kind="episode", key=game_memory_key(state, run_id), content=content[:300], ttl_days=30), None, source="game", source_id=trace_id)
    except MemoryConflict:
        # A forgotten run or a full notebook must not prevent game analysis.
        return None
