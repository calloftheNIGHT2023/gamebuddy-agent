"""MongoDB 存储层，负责画像和分析历史的持久化。"""

from datetime import UTC, datetime
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.models.schemas import AnalysisHistoryItem, AnalysisResponse, FeedbackItem, FeedbackRequest, SupportedGame, TrainingSample, UserProfile


class MongoStore:
    def __init__(self) -> None:
        self._client: MongoClient[Any] | None = None

    @property
    def enabled(self) -> bool:
        return settings.has_mongodb

    def load_user_profile(self, user_id: str | None) -> UserProfile | None:
        if not self.enabled or not user_id:
            return None
        try:
            document = self._profiles.find_one({"user_id": user_id}, {"_id": 0})
        except PyMongoError:
            return None
        if not document:
            return None
        document.pop("created_at", None)
        document.pop("updated_at", None)
        try:
            return UserProfile.model_validate(document)
        except (ValueError, TypeError):
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
            if isinstance(value, list):
                merged[key] = value or merged.get(key, [])
            else:
                merged[key] = value
        return UserProfile.model_validate(merged)

    def upsert_user_profile(self, profile: UserProfile | None) -> None:
        if not self.enabled or profile is None or not profile.user_id:
            return
        payload = profile.model_dump(exclude_none=True)
        timestamp = datetime.now(UTC)
        payload["updated_at"] = timestamp
        try:
            self._profiles.update_one(
                {"user_id": profile.user_id},
                {"$set": payload, "$setOnInsert": {"created_at": timestamp}},
                upsert=True,
            )
        except PyMongoError:
            return

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
        if not self.enabled:
            return
        document = {
            "game": game,
            "question": question,
            "session_id": session_id,
            "user_id": user_profile.user_id if user_profile else None,
            "source": source,
            "user_profile": user_profile.model_dump(exclude_none=True) if user_profile else None,
            "extracted_state": extracted_state,
            "response": response.model_dump(),
            "created_at": datetime.now(UTC),
        }
        try:
            self._history.insert_one(document)
        except PyMongoError:
            return

    def list_analysis_history(
        self,
        *,
        user_id: str | None,
        session_id: str | None,
        limit: int,
    ) -> list[AnalysisHistoryItem]:
        if not self.enabled:
            return []

        query: dict[str, Any] = {}
        if user_id:
            query["user_id"] = user_id
        if session_id:
            query["session_id"] = session_id

        try:
            cursor = self._history.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
            items = list(cursor)
        except PyMongoError:
            return []

        normalized: list[AnalysisHistoryItem] = []
        for item in items:
            item["created_at"] = item["created_at"].isoformat()
            try:
                normalized.append(AnalysisHistoryItem.model_validate(item))
            except (ValueError, TypeError):
                continue
        return normalized

    def save_feedback(self, payload: FeedbackRequest) -> FeedbackItem:
        document = {
            **payload.model_dump(),
            "created_at": datetime.now(UTC),
        }
        if self.enabled:
            try:
                self._feedback.insert_one(document)
            except PyMongoError:
                pass

        normalized = {**document, "created_at": document["created_at"].isoformat()}
        return FeedbackItem.model_validate(normalized)

    def list_feedback(
        self,
        *,
        user_id: str | None,
        session_id: str | None,
        limit: int,
    ) -> list[FeedbackItem]:
        if not self.enabled:
            return []

        query: dict[str, Any] = {}
        if user_id:
            query["user_id"] = user_id
        if session_id:
            query["session_id"] = session_id

        try:
            cursor = self._feedback.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
            items = list(cursor)
        except PyMongoError:
            return []

        normalized: list[FeedbackItem] = []
        for item in items:
            item["created_at"] = item["created_at"].isoformat()
            try:
                normalized.append(FeedbackItem.model_validate(item))
            except (ValueError, TypeError):
                continue
        return normalized

    def export_training_samples(
        self,
        *,
        user_id: str | None,
        session_id: str | None,
        limit: int,
    ) -> list[TrainingSample]:
        feedback_items = self.list_feedback(user_id=user_id, session_id=session_id, limit=limit)
        samples: list[TrainingSample] = []
        for item in feedback_items:
            prompt = {
                "game": item.game,
                "question": item.question,
                "session_id": item.session_id,
                "user_profile": item.user_profile.model_dump(exclude_none=True) if item.user_profile else None,
                "extracted_state": item.extracted_state,
            }
            metadata = {
                "user_id": item.user_id,
                "rating": item.rating,
                "tags": item.tags,
                "created_at": item.created_at,
                "source": "gamebuddy_feedback",
            }
            if item.rating == "down" and item.correction:
                samples.append(
                    TrainingSample(
                        sample_type="preference",
                        prompt=prompt,
                        chosen=item.correction,
                        rejected=item.response,
                        target=item.correction,
                        metadata=metadata,
                    )
                )
            else:
                samples.append(
                    TrainingSample(
                        sample_type="sft",
                        prompt=prompt,
                        target=item.response,
                        metadata=metadata,
                    )
                )
        return samples

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
