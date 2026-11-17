from contextlib import asynccontextmanager

from fastapi import FastAPI

from core.database import Base, engine
from routes.admin_settings import router as admin_settings_router
from routes.applications import router as applications_router
from routes.behavior_metrics import router as behavior_metrics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создаем таблицы при запуске приложения.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(admin_settings_router, prefix="/admin-settings", tags=["admin-settings"])
app.include_router(applications_router, prefix="/applications", tags=["applications"])
app.include_router(behavior_metrics_router, prefix="/behavior-metrics", tags=["behavior-metrics"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
