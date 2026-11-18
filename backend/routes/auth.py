from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import (
    create_access_token,
    get_current_admin,
    hash_password,
    verify_password,
)
from models.admin import Admin, AdminCRUD

router = APIRouter()


class AdminRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Пароль не должен превышать 72 байта")
        return password


class AdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


DbSession = Annotated[Session, Depends(get_db)]


@router.get("/check")
def check_admins(db: DbSession) -> dict[str, int | bool]:
    count = AdminCRUD.count(db)
    return {"count": count, "has_admins": count > 0}


@router.post("/register", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
def register_admin(data: AdminRegister, db: DbSession) -> Admin:
    if AdminCRUD.count(db) > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration closed")

    try:
        return AdminCRUD.create(
            db,
            {
                "username": data.username,
                "email": str(data.email),
                "password_hash": hash_password(data.password),
            },
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Admin with this username or email already exists",
        ) from None


@router.post("/login", response_model=TokenResponse)
def login_admin(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession
) -> TokenResponse:
    admin = AdminCRUD.get_by_username(db, form_data.username)
    if (
        admin is None
        or not admin.is_active
        or not verify_password(form_data.password, admin.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(
        access_token=create_access_token(admin.username), token_type="bearer"
    )


@router.get("/me", response_model=AdminResponse)
def get_me(current_admin: Annotated[Admin, Depends(get_current_admin)]) -> Admin:
    return current_admin
