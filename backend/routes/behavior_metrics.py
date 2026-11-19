import json
import re
from datetime import datetime
from json import JSONDecodeError
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    ValidationError,
    field_validator,
)
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_admin
from models.admin import Admin
from models.behavior_metrics import BehaviorMetrics, BehaviorMetricsCRUD

router = APIRouter()


class ClickItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=60)
    count: int = Field(strict=True, ge=0, le=100000)


class HoverPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float = Field(ge=0, le=100, allow_inf_nan=False)
    y: float = Field(ge=0, le=100, allow_inf_nan=False)

    @field_validator("x", "y", mode="before")
    @classmethod
    def validate_coordinate_type(cls, value: object) -> object:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Координата должна быть числом")
        return value


class BehaviorMetricsCreate(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    time_on_page_seconds: int = Field(strict=True, ge=0, le=900)
    clicks_data: str = Field(max_length=5000)
    hover_data: str = Field(max_length=40000)
    return_visits: int = Field(default=0, strict=True, ge=0, le=1_000_000)

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, value: str) -> str:
        if re.fullmatch(r"[A-Za-z0-9_-]{8,64}", value) is None:
            raise ValueError("Недопустимый формат session_id")
        return value

    @field_validator("clicks_data")
    @classmethod
    def validate_clicks_data(cls, value: str) -> str:
        try:
            parsed = json.loads(value)
        except JSONDecodeError as exc:
            raise ValueError("clicks_data должен содержать JSON-массив") from exc
        if not isinstance(parsed, list) or len(parsed) > 200:
            raise ValueError("clicks_data должен содержать не более 200 элементов")
        try:
            TypeAdapter(list[ClickItem]).validate_python(parsed)
        except ValidationError as exc:
            raise ValueError("Некорректный элемент clicks_data") from exc
        return value

    @field_validator("hover_data")
    @classmethod
    def validate_hover_data(cls, value: str) -> str:
        try:
            parsed = json.loads(value)
        except JSONDecodeError as exc:
            raise ValueError("hover_data должен содержать JSON-массив") from exc
        if not isinstance(parsed, list) or len(parsed) > 900:
            raise ValueError("hover_data должен содержать не более 900 элементов")
        try:
            TypeAdapter(list[HoverPoint]).validate_python(parsed)
        except ValidationError as exc:
            raise ValueError("Некорректный элемент hover_data") from exc
        return value


class BehaviorMetricsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    time_on_page_seconds: int
    clicks_data: str
    hover_data: str
    return_visits: int
    created_at: datetime
    updated_at: datetime


DbSession = Annotated[Session, Depends(get_db)]
AdminAuth = Annotated[Admin, Depends(get_current_admin)]


@router.post("/", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def upsert_behavior_metrics(data: BehaviorMetricsCreate, db: DbSession) -> Response:
    BehaviorMetricsCRUD.upsert(db, data.model_dump())
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/summary")
def get_behavior_metrics_summary(db: DbSession, _: AdminAuth) -> dict[str, object]:
    recent = BehaviorMetricsCRUD.get_recent_for_stats(db)
    button_totals: dict[str, int] = {}
    for visit in recent:
        try:
            clicks = json.loads(visit.clicks_data)
        except JSONDecodeError:
            continue
        if not isinstance(clicks, list):
            continue
        for item in clicks:
            try:
                click = ClickItem.model_validate(item)
            except ValidationError:
                continue
            button_totals[click.name] = button_totals.get(click.name, 0) + click.count

    top_buttons = [
        {"name": name, "count": count}
        for name, count in sorted(
            button_totals.items(), key=lambda item: (-item[1], item[0])
        )[:10]
    ]
    return {**BehaviorMetricsCRUD.get_summary(db), "top_buttons": top_buttons}


@router.get("/heatmap")
def get_behavior_metrics_heatmap(db: DbSession, _: AdminAuth) -> dict[str, object]:
    recent = BehaviorMetricsCRUD.get_recent_for_stats(db)
    cells: dict[tuple[int, int], int] = {}
    total_points = 0
    for visit in recent:
        try:
            points = json.loads(visit.hover_data)
        except JSONDecodeError:
            continue
        if not isinstance(points, list):
            continue
        for item in points:
            try:
                point = HoverPoint.model_validate(item)
            except ValidationError:
                continue
            x = min(49, int(point.x // 2))
            y = min(49, int(point.y // 2))
            cells[(x, y)] = cells.get((x, y), 0) + 1
            total_points += 1

    return {
        "total_points": total_points,
        "cells": [
            {"x": x, "y": y, "count": count}
            for (x, y), count in sorted(cells.items())
        ],
    }


@router.get("/", response_model=list[BehaviorMetricsResponse])
def get_all_behavior_metrics(
    db: DbSession,
    _: AdminAuth,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[BehaviorMetrics]:
    return BehaviorMetricsCRUD.get_all(db, skip=skip, limit=limit)
