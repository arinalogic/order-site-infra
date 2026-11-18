from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from core.database import Base


class Admin(Base):
    """SQL:
    CREATE TABLE admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR NOT NULL UNIQUE,
        password_hash VARCHAR NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """

    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AdminCRUD:
    @staticmethod
    def create(db: Session, data: dict[str, Any]) -> Admin:
        item = Admin(**data)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_by_username(db: Session, username: str) -> Admin | None:
        statement = select(Admin).where(Admin.username == username)
        return db.scalars(statement).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Admin | None:
        statement = select(Admin).where(Admin.email == email)
        return db.scalars(statement).first()

    @staticmethod
    def count(db: Session) -> int:
        return db.scalar(select(func.count()).select_from(Admin)) or 0
