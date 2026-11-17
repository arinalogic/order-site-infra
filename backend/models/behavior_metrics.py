from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from core.database import Base


class BehaviorMetrics(Base):
    """SQL:
    CREATE TABLE behavior_metrics (
        application_id INTEGER PRIMARY KEY REFERENCES applications(id),
        time_on_page_seconds INTEGER NOT NULL DEFAULT 0,
        clicks_data TEXT NOT NULL DEFAULT '[]',
        hover_data TEXT NOT NULL DEFAULT '[]',
        return_visits INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """

    __tablename__ = "behavior_metrics"

    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id"), primary_key=True
    )
    time_on_page_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    clicks_data: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]", server_default=text("'[]'")
    )
    hover_data: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]", server_default=text("'[]'")
    )
    return_visits: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class BehaviorMetricsCRUD:
    @staticmethod
    def create(db: Session, data: dict[str, Any]) -> BehaviorMetrics:
        item = BehaviorMetrics(**data)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get(db: Session, application_id: int) -> BehaviorMetrics | None:
        return db.get(BehaviorMetrics, application_id)

    @staticmethod
    def get_all(db: Session) -> list[BehaviorMetrics]:
        return list(
            db.scalars(select(BehaviorMetrics).order_by(BehaviorMetrics.application_id)).all()
        )

    @staticmethod
    def update(
        db: Session, application_id: int, data: dict[str, Any]
    ) -> BehaviorMetrics | None:
        item = db.get(BehaviorMetrics, application_id)
        if item is None:
            return None
        for field, value in data.items():
            setattr(item, field, value)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete(db: Session, application_id: int) -> bool:
        item = db.get(BehaviorMetrics, application_id)
        if item is None:
            return False
        db.delete(item)
        db.commit()
        return True
