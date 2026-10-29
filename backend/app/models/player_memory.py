"""Explicit player notes. Match snapshots are never promoted into player facts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MemoryGame = Literal["pokemon-battle-demo", "moba-postmatch-demo", "rpg-build-demo", "town", "river", "dungeon"]
MemoryKind = Literal["note", "goal", "lesson", "episode"]


class MemoryInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    game: MemoryGame | None = None
    kind: MemoryKind = "note"
    key: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_.:-]+$")
    content: str = Field(min_length=1, max_length=300)
    ttl_days: int | None = Field(default=None, ge=1, le=365)


class MemoryWrite(MemoryInput):
    user_id: str = Field(min_length=1, max_length=128)
    expected_revision: int = Field(default=0, ge=0)


class MemoryEdit(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    user_id: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1, max_length=300)
    ttl_days: int | None = Field(default=None, ge=1, le=365)
    expected_revision: int = Field(ge=1)


class PlayerMemory(BaseModel):
    id: str
    user_id: str
    game: MemoryGame | None
    kind: MemoryKind
    key: str
    content: str
    revision: int
    source: Literal["user", "explicit_request", "game"]
    source_id: str | None
    created_at: str
    updated_at: str
    expires_at: str | None
