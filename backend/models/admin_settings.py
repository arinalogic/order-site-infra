from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from core.database import Base


class AdminSettings(Base):
    """SQL:
    CREATE TABLE admin_settings (
        id SERIAL PRIMARY KEY,
        services VARCHAR NOT NULL,
        budget_range VARCHAR NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """

    __tablename__ = "admin_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    services: Mapped[str] = mapped_column(String, nullable=False)
    budget_range: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class AdminSettingsCRUD:
    @staticmethod
    def create(db: Session, data: dict[str, Any]) -> AdminSettings:
        item = AdminSettings(**data)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get(db: Session, item_id: int) -> AdminSettings | None:
        return db.get(AdminSettings, item_id)

    @staticmethod
    def get_all(db: Session) -> list[AdminSettings]:
        return list(db.scalars(select(AdminSettings).order_by(AdminSettings.id)).all())

    @staticmethod
    def get_latest(db: Session) -> AdminSettings | None:
        statement = select(AdminSettings).order_by(
            AdminSettings.created_at.desc(), AdminSettings.id.desc()
        )
        return db.scalars(statement).first()

    @staticmethod
    def update(db: Session, item_id: int, data: dict[str, Any]) -> AdminSettings | None:
        item = db.get(AdminSettings, item_id)
        if item is None:
            return None
        for field, value in data.items():
            setattr(item, field, value)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete(db: Session, item_id: int) -> bool:
        item = db.get(AdminSettings, item_id)
        if item is None:
            return False
        db.delete(item)
        db.commit()
        return True
