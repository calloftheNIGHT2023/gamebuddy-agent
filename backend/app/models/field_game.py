"""Bounded snapshots of the three original 9 by 6 browser games."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Scene = Literal["town", "river", "dungeon"]
Identifier = Annotated[str, Field(min_length=1, max_length=64)]
Name = Annotated[str, Field(min_length=1, max_length=80)]


class SnapshotModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", str_strip_whitespace=True)


class Position(SnapshotModel):
    x: int = Field(ge=0, le=8)
    y: int = Field(ge=0, le=5)

    def cell(self) -> tuple[int, int]:
        return self.x, self.y


class FieldEnemy(Position):
    id: Identifier
    name: Name
    hp: int = Field(ge=0, le=1000)
    max_hp: int = Field(ge=1, le=1000)
    attack: int = Field(ge=1, le=100)

    @model_validator(mode="after")
    def health_bound(self):
        if self.hp > self.max_hp:
            raise ValueError("enemy hp must not exceed max_hp")
        return self


class FieldObjective(Position):
    id: Identifier
    name: Name
    done: bool


class FieldEvent(SnapshotModel):
    turn: int = Field(ge=0, le=200)
    text: str = Field(min_length=1, max_length=360)
    kind: str = Field(min_length=1, max_length=32)


class FieldState(SnapshotModel):
    turn: int = Field(ge=0, le=200)
    max_turns: int = Field(ge=1, le=200)
    hp: int = Field(ge=0, le=1000)
    max_hp: int = Field(ge=1, le=1000)
    stamina: int = Field(ge=0, le=100)
    max_stamina: int = Field(ge=1, le=100)
    attack: int = Field(ge=1, le=100)
    defense: int = Field(ge=0, le=100)
    potions: int = Field(ge=0, le=99)
    gold: int = Field(ge=0, le=9999)
    position: Position
    enemies: list[FieldEnemy] = Field(max_length=24)
    objectives: list[FieldObjective] = Field(max_length=6)
    exit: Position | None
    walls: list[Position] = Field(max_length=54)
    status: Literal["playing", "won", "lost"]
    events: list[FieldEvent] = Field(max_length=120)
    last_action: str = Field(max_length=200)

    @model_validator(mode="after")
    def consistent_snapshot(self):
        if self.hp > self.max_hp or self.stamina > self.max_stamina:
            raise ValueError("hp/stamina must not exceed their maxima")
        if self.turn > self.max_turns:
            raise ValueError("turn must not exceed max_turns")
        walls = [position.cell() for position in self.walls]
        if len(walls) != len(set(walls)):
            raise ValueError("walls must not contain duplicate cells")
        wall_set = set(walls)
        live_cells = [enemy.cell() for enemy in self.enemies if enemy.hp > 0]
        if len(live_cells) != len(set(live_cells)) or self.position.cell() in live_cells:
            raise ValueError("living enemies and the player must occupy different cells")
        cells = [self.position.cell(), *live_cells, *(objective.cell() for objective in self.objectives)]
        if self.exit is not None:
            cells.append(self.exit.cell())
        if any(cell in wall_set for cell in cells):
            raise ValueError("player, living enemies, objectives and exit must be outside walls")
        for entities in (self.enemies, self.objectives):
            if len({entity.id for entity in entities}) != len(entities):
                raise ValueError("entity ids must be unique within each list")
        if len({objective.cell() for objective in self.objectives}) != len(self.objectives):
            raise ValueError("objectives must occupy different cells")
        turns = [event.turn for event in self.events]
        if any(turn > self.turn for turn in turns) or turns != sorted(turns):
            raise ValueError("events must be chronological and must not refer to future turns")
        if self.status == "playing" and (self.hp == 0 or self.turn >= self.max_turns):
            raise ValueError("playing requires positive hp and remaining turns")
        if self.status == "won" and self.hp == 0:
            raise ValueError("won requires positive hp")
        if self.status == "lost" and self.hp > 0 and self.turn < self.max_turns:
            raise ValueError("lost requires zero hp or the turn limit")
        return self


class FieldAnalysisRequest(SnapshotModel):
    scene: Scene
    state: FieldState
    player_id: str | None = Field(default=None, min_length=1, max_length=128)
    run_id: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def scene_objectives(self):
        required = 2 if self.scene == "dungeon" else 3
        if len(self.state.objectives) != required:
            raise ValueError(f"{self.scene} requires {required} objectives")
        if (self.scene == "river") != (self.state.exit is None):
            raise ValueError("river has no exit; town and dungeon require an exit")
        complete = all(objective.done for objective in self.state.objectives)
        finished = complete and (self.scene == "river" or self.state.position == self.state.exit)
        if self.state.status == "won" and not finished:
            raise ValueError("won requires all objectives and the scene exit condition")
        if self.state.hp > 0 and finished and self.state.status != "won":
            raise ValueError("a completed scene with positive hp must have won status")
        return self
