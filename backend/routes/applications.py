from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from core.database import get_db
from models.application import Application, ApplicationCRUD

router = APIRouter()


class ApplicationCreate(BaseModel):
    first_name: str
    last_name: str
    middle_name: str | None = None
    phone: str | None = None
    email: str | None = None
    business_info: str | None = None
    business_niche: str | None = None
    company_size: str | None = None
    client_role: str | None = None
    task_volume: str | None = None
    deadline: str | None = None
    task_type: str | None = None
    product_of_interest: str | None = None
    service: str | None = None
    budget: str | None = None
    preferred_contact_method: str | None = None
    preferred_contact_time: str | None = None
    comments: str | None = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    middle_name: str | None
    phone: str | None
    email: str | None
    business_info: str | None
    business_niche: str | None
    company_size: str | None
    client_role: str | None
    task_volume: str | None
    deadline: str | None
    task_type: str | None
    product_of_interest: str | None
    service: str | None
    budget: str | None
    preferred_contact_method: str | None
    preferred_contact_time: str | None
    comments: str | None
    created_at: datetime


DbSession = Annotated[Session, Depends(get_db)]


@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationCreate, db: DbSession) -> Application:
    return ApplicationCRUD.create(db, data.model_dump())


@router.get("/", response_model=list[ApplicationResponse])
def get_all_applications(db: DbSession) -> list[Application]:
    return ApplicationCRUD.get_all(db)


@router.get("/{item_id}", response_model=ApplicationResponse)
def get_application(item_id: int, db: DbSession) -> Application:
    item = ApplicationCRUD.get(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return item
