"""Local-first private memory, with optional MongoDB replication.

Profiles, analysis history and feedback always reach SQLite before an optional
remote write. A MongoDB failure therefore cannot silently discard user data.
"""

import json
import logging
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any, Literal
from uuid import uuid4

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.models.schemas import AnalysisHistoryItem, AnalysisResponse, FeedbackItem, FeedbackRequest, SupportedGame, TrainingSample, UserProfile
from app.services import ops
from app.services.local_store import LocalStore, local_store

logger = logging.getLogger(__name__)


class MongoStore:
    def __init__(self, store: LocalStore | None = None) -> None:
        self._client: MongoClient[Any] | None = None
        self._local = store if store is not None else local_store

    @property
    def enabled(self) -> bool:
        """Whether optional MongoDB replication is configured."""
        return settings.has_mongodb

    def load_user_profile(self, user_id: str | None) -> UserProfile | None:
        if not user_id:
            return None
        document = self._local.get("user_profiles", user_id)
        if document is None and self.enabled:
            try:
                document = self._profiles.find_one({"user_id": user_id}, {"_id": 0})
                if document:
                    self._local.put("user_profiles", user_id, self._json_document(document))
            except PyMongoError:
                logger.warning("MongoDB profile read failed; using local memory", exc_info=True)
        if not document:
            return None
        try:
            return UserProfile.model_validate(document)
        except (ValueError, TypeError):
            logger.warning("Ignoring an invalid stored user profile for %s", user_id)
            return None

    def merge_user_profile(self, request_profile: UserProfile | None) -> UserProfile | None:
        if request_profile is None:
            return None
        stored_profile = self.load_user_profile(request_profile.user_id)
        if stored_profile is None:
            return request_profile
        merged = stored_profile.model_dump()
        for key, value in request_profile.model_dump().items():
            if value is None:
                continue
            merged[key] = (value or merged.get(key, [])) if isinstance(value, list) else value
        return UserProfile.model_validate(merged)

    def upsert_user_profile(self, profile: UserProfile | None) -> None:
        if profile is None or not profile.user_id:
            return
        payload = profile.model_dump(mode="json", exclude_none=True)
        payload["updated_at"] = datetime.now(UTC).isoformat()
        self._local.put("user_profiles", profile.user_id, payload)
        if self.enabled:
            try:
                self._profiles.update_one(
                    {"user_id": profile.user_id},
                    {"$set": payload, "$setOnInsert": {"created_at": payload["updated_at"]}},
                    upsert=True,
                )
            except PyMongoError:
                logger.warning("MongoDB profile write failed; profile remains saved locally", exc_info=True)

    def save_analysis_history(
        self,
        *,
        game: SupportedGame,
        question: str,
        session_id: str | None,
        user_profile: UserProfile | None,
        extracted_state: dict[str, Any],
        response: AnalysisResponse,
        source: str,
    ) -> None:
        document = {
            "record_id": uuid4().hex,
            "game": game,
            "question": question,
            "session_id": session_id,
            "user_id": user_profile.user_id if user_profile else None,
            "source": source,
            "user_profile": user_profile.model_dump(mode="json", exclude_none=True) if user_profile else None,
            "extracted_state": extracted_state,
            "response": response.model_dump(mode="json"),
            "created_at": datetime.now(UTC).isoformat(),
        }
        self._local.put("analysis_history", document["record_id"], document)
        if self.enabled:
            try:
                self._history.insert_one(dict(document))
            except PyMongoError:
                logger.warning("MongoDB history write failed; analysis remains saved locally", exc_info=True)

    def list_analysis_history(
        self, *, user_id: str | None, session_id: str | None, limit: int
    ) -> list[AnalysisHistoryItem]:
        documents = self._list_documents("analysis_history", user_id=user_id, session_id=session_id, limit=limit)
        items: list[AnalysisHistoryItem] = []
        for document in documents:
            try:
                items.append(AnalysisHistoryItem.model_validate(document))
            except (ValueError, TypeError):
                logger.warning("Ignoring an invalid stored analysis history record")
        return items

    def save_feedback(self, payload: FeedbackRequest) -> FeedbackItem:
        document = {
            **payload.model_dump(mode="json"),
            "record_id": uuid4().hex,
            "created_at": datetime.now(UTC).isoformat(),
        }
        self._local.put("feedback", document["record_id"], document)
        if self.enabled:
            try:
                self._feedback.insert_one(dict(document))
            except PyMongoError:
                logger.warning("MongoDB feedback write failed; feedback remains saved locally", exc_info=True)
        return FeedbackItem.model_validate(document)

    def list_feedback(self, *, user_id: str | None, session_id: str | None, limit: int) -> list[FeedbackItem]:
        documents = self._list_documents("feedback", user_id=user_id, session_id=session_id, limit=limit)
        items: list[FeedbackItem] = []
        for document in documents:
            try:
                items.append(FeedbackItem.model_validate(document))
            except (ValueError, TypeError):
                logger.warning("Ignoring an invalid stored feedback record")
        return items

    def export_training_samples(
        self,
        *,
        user_id: str | None,
        session_id: str | None,
        limit: int,
        sample_type: Literal["sft", "preference"] | None = None,
    ) -> list[TrainingSample]:
        """Export reviewed local development records, never neutral or uncorrected dislikes.

        The default preserves the existing API: approvals become SFT records and
        corrected dislikes become preference records. Requesting SFT explicitly
        also turns human corrections into supervised targets.
        """
        feedback_items = self.list_feedback(user_id=user_id, session_id=session_id, limit=limit)
        samples: list[TrainingSample] = []
        for item in feedback_items:
            correction = item.correction.strip() if item.correction else ""
            if item.rating == "neutral" or (item.rating == "down" and not correction):
                continue
            if item.rating == "down" and self._same_answer(correction, item.response):
                continue
            if sample_type == "preference" and item.rating != "down":
                continue
            trace = self._verified_trace(item)
            policy = self._trace_policy(trace) if trace else None
            prompt = {
                "game": item.game,
                "question": item.question,
                "session_id": item.session_id,
                "user_profile": item.user_profile.model_dump(exclude_none=True) if item.user_profile else None,
                "extracted_state": item.extracted_state,
                "task": trace.get("task", "analysis") if trace else item.response.metadata.get("task", "analysis"),
                "policy": policy,
            }
            metadata = {
                "user_id": item.user_id,
                "rating": item.rating,
                "tags": item.tags,
                "created_at": item.created_at,
                "source": "gamebuddy_feedback",
                "trace_id": trace["id"] if trace else None,
                "trace_verified": trace is not None,
                "provenance": "verified_trace" if trace else "legacy_feedback",
                "policy_id": trace.get("policy_id") if trace else None,
                "policy_verified": policy is not None,
                "data_usage": "local_private_development",
            }
            if not trace:
                metadata["unverified_policy_id"] = item.response.metadata.get("policy_id")
            if item.rating == "down" and sample_type != "sft":
                samples.append(TrainingSample(
                    sample_type="preference", prompt=prompt, chosen=correction,
                    rejected=item.response, target=correction, metadata=metadata,
                ))
            else:
                samples.append(TrainingSample(
                    sample_type="sft", prompt=prompt,
                    target=correction if item.rating == "down" else item.response, metadata=metadata,
                ))
        return samples

    def _verified_trace(self, item: FeedbackItem) -> dict[str, Any] | None:
        trace_id = item.response.metadata.get("trace_id")
        if not isinstance(trace_id, str) or not trace_id:
            return None
        trace = self._local.get("traces", trace_id)
        if not trace or trace.get("id") != trace_id or not trace.get("response"):
            return None
        try:
            canonical_response = AnalysisResponse.model_validate(trace["response"]).model_dump(mode="json")
            canonical_profile = UserProfile.model_validate(trace["user_profile"]) if trace.get("user_profile") else None
        except (ValueError, TypeError):
            return None
        expected = (
            trace.get("game"), trace.get("question"), trace.get("state"), canonical_response,
            canonical_profile, trace.get("session_id"), canonical_profile.user_id if canonical_profile else None,
        )
        actual = (
            item.game, item.question, item.extracted_state, item.response.model_dump(mode="json"),
            item.user_profile, item.session_id, item.user_id,
        )
        return trace if actual == expected else None

    def _trace_policy(self, trace: dict[str, Any]) -> dict[str, Any] | None:
        policy_id = trace.get("policy_id")
        snapshot = trace.get("policy_snapshot") or trace.get("policy")
        if isinstance(snapshot, dict) and snapshot.get("id") == policy_id:
            policy = snapshot
        elif policy_id == ops.DEFAULT_POLICY["id"]:
            policy = ops.DEFAULT_POLICY
        elif isinstance(policy_id, str) and policy_id:
            # Read the immutable policy version from the same database as its
            # trace, including for injected stores and restored local data.
            policy = self._local.get("policies", policy_id)
        else:
            return None
        fields = ("id", "prompt", "instructions", "max_next_steps")
        if not policy or policy.get("id") != policy_id or any(field not in policy for field in fields):
            return None
        return {field: policy[field] for field in fields}

    @staticmethod
    def _same_answer(correction: str, response: AnalysisResponse) -> bool:
        if correction == response.summary.strip():
            return True
        try:
            return json.loads(correction) == response.model_dump(mode="json")
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _json_document(document: dict[str, Any]) -> dict[str, Any]:
        normalized = {key: value for key, value in document.items() if key != "_id"}
        for field in ("created_at", "updated_at"):
            if isinstance(normalized.get(field), datetime):
                normalized[field] = normalized[field].isoformat()
        return normalized

    def _list_documents(
        self, collection: str, *, user_id: str | None, session_id: str | None, limit: int
    ) -> list[dict[str, Any]]:
        query = {key: value for key, value in {"user_id": user_id, "session_id": session_id}.items() if value}
        # Filter before limiting so older users' records stay accessible.
        local = [item for item in self._local.list(collection, limit=2**31 - 1)
                 if all(item.get(key) == value for key, value in query.items())]
        remote: list[dict[str, Any]] = []
        if self.enabled:
            try:
                target = self._history if collection == "analysis_history" else self._feedback
                remote = [self._json_document(item) for item in
                          target.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)]
            except PyMongoError:
                logger.warning("MongoDB %s read failed; using local memory", collection, exc_info=True)
        # Replicas carry the same record_id; local copies win on duplicates.
        merged: dict[str, dict[str, Any]] = {}
        for item in [*remote, *local]:
            identity = item.get("record_id") or json.dumps(item, sort_keys=True, ensure_ascii=False)
            merged[identity] = item
        local_identities = {
            item.get("record_id") or json.dumps(item, sort_keys=True, ensure_ascii=False) for item in local
        }
        for item in remote:
            identity = item.get("record_id") or json.dumps(item, sort_keys=True, ensure_ascii=False)
            if identity not in local_identities:
                # Cache remote-only records so a later outage still has memory.
                key = item.get("record_id") or "mongo-" + sha256(identity.encode("utf-8")).hexdigest()
                self._local.put(collection, key, item)
        return sorted(merged.values(), key=lambda item: item.get("created_at", ""), reverse=True)[:limit]

    @property
    def _db(self):
        if self._client is None:
            self._client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=1500)
        return self._client[settings.mongodb_database]

    @property
    def _profiles(self) -> Collection[Any]:
        return self._db[settings.mongodb_user_profiles_collection]

    @property
    def _history(self) -> Collection[Any]:
        return self._db[settings.mongodb_analysis_history_collection]

    @property
    def _feedback(self) -> Collection[Any]:
        return self._db[settings.mongodb_feedback_collection]


mongo_store = MongoStore()
