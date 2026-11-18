from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_admin
from models.admin import Admin
from models.admin_settings import AdminSettings, AdminSettingsCRUD

router = APIRouter()


class AdminSettingsCreate(BaseModel):
    services: str
    budget_range: str


class AdminSettingsUpdate(BaseModel):
    services: str
    budget_range: str


class AdminSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    services: str
    budget_range: str
    created_at: datetime
    updated_at: datetime


DbSession = Annotated[Session, Depends(get_db)]


@router.get("/", response_model=list[AdminSettingsResponse])
def get_all_admin_settings(db: DbSession) -> list[AdminSettings]:
    return AdminSettingsCRUD.get_all(db)


@router.get("/latest", response_model=AdminSettingsResponse)
def get_latest_admin_settings(db: DbSession) -> AdminSettings:
    item = AdminSettingsCRUD.get_latest(db)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settings not found")
    return item


@router.get("/{item_id}", response_model=AdminSettingsResponse)
def get_admin_settings(item_id: int, db: DbSession) -> AdminSettings:
    item = AdminSettingsCRUD.get(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settings not found")
    return item


@router.post("/", response_model=AdminSettingsResponse, status_code=status.HTTP_201_CREATED)
def create_admin_settings(
    data: AdminSettingsCreate,
    db: DbSession,
    _: Annotated[Admin, Depends(get_current_admin)],
) -> AdminSettings:
    return AdminSettingsCRUD.create(db, data.model_dump())


@router.put("/{item_id}", response_model=AdminSettingsResponse)
def update_admin_settings(
    item_id: int,
    data: AdminSettingsUpdate,
    db: DbSession,
    _: Annotated[Admin, Depends(get_current_admin)],
) -> AdminSettings:
    item = AdminSettingsCRUD.update(db, item_id, data.model_dump())
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settings not found")
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_settings(
    item_id: int, db: DbSession, _: Annotated[Admin, Depends(get_current_admin)]
) -> Response:
    if not AdminSettingsCRUD.delete(db, item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settings not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
