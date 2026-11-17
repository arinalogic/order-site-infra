from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from core.database import Base


class Application(Base):
    """SQL:
    CREATE TABLE applications (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR NOT NULL,
        last_name VARCHAR NOT NULL,
        middle_name VARCHAR,
        phone VARCHAR,
        email VARCHAR,
        business_info VARCHAR,
        business_niche VARCHAR,
        company_size VARCHAR,
        client_role VARCHAR,
        task_volume VARCHAR,
        deadline VARCHAR,
        task_type VARCHAR,
        product_of_interest VARCHAR,
        service VARCHAR,
        budget VARCHAR,
        preferred_contact_method VARCHAR,
        preferred_contact_time VARCHAR,
        comments VARCHAR,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    business_info: Mapped[str | None] = mapped_column(String)
    business_niche: Mapped[str | None] = mapped_column(String)
    company_size: Mapped[str | None] = mapped_column(String)
    client_role: Mapped[str | None] = mapped_column(String)
    task_volume: Mapped[str | None] = mapped_column(String)
    deadline: Mapped[str | None] = mapped_column(String)
    task_type: Mapped[str | None] = mapped_column(String)
    product_of_interest: Mapped[str | None] = mapped_column(String)
    service: Mapped[str | None] = mapped_column(String)
    budget: Mapped[str | None] = mapped_column(String)
    preferred_contact_method: Mapped[str | None] = mapped_column(String)
    preferred_contact_time: Mapped[str | None] = mapped_column(String)
    comments: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ApplicationCRUD:
    @staticmethod
    def create(db: Session, data: dict[str, Any]) -> Application:
        item = Application(**data)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get(db: Session, item_id: int) -> Application | None:
        return db.get(Application, item_id)

    @staticmethod
    def get_all(db: Session) -> list[Application]:
        return list(db.scalars(select(Application).order_by(Application.id)).all())

    @staticmethod
    def update(db: Session, item_id: int, data: dict[str, Any]) -> Application | None:
        item = db.get(Application, item_id)
        if item is None:
            return None
        for field, value in data.items():
            setattr(item, field, value)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete(db: Session, item_id: int) -> bool:
        item = db.get(Application, item_id)
        if item is None:
            return False
        db.delete(item)
        db.commit()
        return True
