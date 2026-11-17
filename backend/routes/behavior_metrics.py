from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from core.database import get_db
from models.behavior_metrics import BehaviorMetrics, BehaviorMetricsCRUD

router = APIRouter()


class BehaviorMetricsCreate(BaseModel):
    application_id: int
    time_on_page_seconds: int = 0
    clicks_data: str = "[]"
    hover_data: str = "[]"
    return_visits: int = 0


class BehaviorMetricsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    application_id: int
    time_on_page_seconds: int
    clicks_data: str
    hover_data: str
    return_visits: int
    created_at: datetime


DbSession = Annotated[Session, Depends(get_db)]


@router.post("/", response_model=BehaviorMetricsResponse, status_code=status.HTTP_201_CREATED)
def create_behavior_metrics(
    data: BehaviorMetricsCreate, db: DbSession
) -> BehaviorMetrics:
    return BehaviorMetricsCRUD.create(db, data.model_dump())


@router.get("/", response_model=list[BehaviorMetricsResponse])
def get_all_behavior_metrics(db: DbSession) -> list[BehaviorMetrics]:
    return BehaviorMetricsCRUD.get_all(db)


@router.get("/{application_id}", response_model=BehaviorMetricsResponse)
def get_behavior_metrics(application_id: int, db: DbSession) -> BehaviorMetrics:
    item = BehaviorMetricsCRUD.get(db, application_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Behavior metrics not found"
        )
    return item
