from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import DateTime, Index, Integer, String, Text, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Mapped, Session, mapped_column

from core.database import Base


class BehaviorMetrics(Base):
    """SQL:
    CREATE TABLE behavior_metrics (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL UNIQUE,
        time_on_page_seconds INTEGER NOT NULL DEFAULT 0,
        clicks_data TEXT NOT NULL DEFAULT '[]',
        hover_data TEXT NOT NULL DEFAULT '[]',
        return_visits INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_behavior_metrics_updated_at
        ON behavior_metrics (updated_at);
    """

    __tablename__ = "behavior_metrics"
    __table_args__ = (Index("ix_behavior_metrics_updated_at", "updated_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class BehaviorMetricsCRUD:
    @staticmethod
    def upsert(db: Session, data: dict[str, Any]) -> None:
        statement = insert(BehaviorMetrics).values(**data)
        statement = statement.on_conflict_do_update(
            index_elements=[BehaviorMetrics.session_id],
            set_={
                "time_on_page_seconds": func.greatest(
                    BehaviorMetrics.time_on_page_seconds,
                    statement.excluded.time_on_page_seconds,
                ),
                "clicks_data": statement.excluded.clicks_data,
                "hover_data": statement.excluded.hover_data,
                "return_visits": statement.excluded.return_visits,
                "updated_at": func.now(),
            },
        )
        db.execute(statement)
        db.commit()

    @staticmethod
    def get_all(db: Session, skip: int, limit: int) -> list[BehaviorMetrics]:
        statement = (
            select(BehaviorMetrics)
            .order_by(BehaviorMetrics.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(statement).all())

    @staticmethod
    def get_summary(db: Session) -> dict[str, dict[str, float | int]]:
        now = datetime.now(timezone.utc)
        windows = {
            "day": timedelta(days=1),
            "week": timedelta(days=7),
            "month": timedelta(days=30),
        }
        summary: dict[str, dict[str, float | int]] = {}
        for name, duration in windows.items():
            result = db.execute(
                select(
                    func.avg(BehaviorMetrics.time_on_page_seconds),
                    func.count(BehaviorMetrics.id),
                ).where(BehaviorMetrics.updated_at >= now - duration)
            ).one()
            average, visits = result
            summary[name] = {
                "avg_seconds": round(float(average or 0), 1),
                "visits": visits,
            }
        return summary

    @staticmethod
    def get_recent_for_stats(db: Session) -> list[BehaviorMetrics]:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        statement = (
            select(BehaviorMetrics)
            .where(BehaviorMetrics.updated_at >= since)
            .order_by(BehaviorMetrics.updated_at.desc())
            .limit(500)
        )
        return list(db.scalars(statement).all())
