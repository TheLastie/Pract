"""FastAPI entry point for the Mushroom Atlas."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import LargeBinary, inspect, text

from .database import Base, SessionLocal, engine
from .routers.mushrooms import router as mushrooms_router
from .seed import seed_if_empty


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCS_ASSETS = Path(__file__).resolve().parent / "docs_assets"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    columns = {column["name"] for column in inspect(engine).get_columns("mushrooms")}
    missing = {"photo_data", "photo_data_2"} - columns
    if missing:
        binary_type = engine.dialect.type_compiler.process(LargeBinary())
        with engine.begin() as connection:
            for column in missing:
                connection.exec_driver_sql(f"ALTER TABLE mushrooms ADD COLUMN {column} {binary_type}")
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


app = FastAPI(
    title="Грибной атлас API",
    version="1.0.0",
    description="REST API каталога грибов. Данные сохраняются в SQLite.",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)
app.include_router(mushrooms_router, prefix="/api")


@app.get("/docs", include_in_schema=False)
def swagger_docs():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} — Swagger UI",
        swagger_js_url="/docs-assets/swagger-ui-bundle.js",
        swagger_css_url="/docs-assets/swagger-ui.css",
        swagger_favicon_url="data:,",
    )


@app.get("/redoc", include_in_schema=False)
def redoc_docs():
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} — ReDoc",
        redoc_js_url="/docs-assets/redoc.standalone.js",
        redoc_favicon_url="data:,",
        with_google_fonts=False,
    )


@app.get("/healthcheck", include_in_schema=False)
def healthcheck() -> dict[str, str]:
    """Для Docker: 200, если API работает и база отвечает."""
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(PROJECT_ROOT / "index.html")


app.mount("/css", StaticFiles(directory=PROJECT_ROOT / "css"), name="css")
app.mount("/js", StaticFiles(directory=PROJECT_ROOT / "js"), name="js")
app.mount("/assets", StaticFiles(directory=PROJECT_ROOT / "assets"), name="assets")
app.mount("/docs-assets", StaticFiles(directory=DOCS_ASSETS), name="docs-assets")
