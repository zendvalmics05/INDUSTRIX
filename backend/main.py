
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from core.database import Base, engine

from routers.team import auth as team_auth
from routers.team import leaderboard as team_leaderboard
from routers.team import procurement as team_procurement
from routers.team import production as team_production
from routers.team import sales as team_sales
from routers.team import inventory as team_inventory
from routers.team import events as team_events
from routers.team import briefing as team_briefing
from routers.organiser import cycle   as org_cycle
from routers.organiser import deals   as org_deals
from routers.organiser import teams   as org_teams
from routers.organiser import auction as org_aucts
from routers.organiser import market  as org_marks

Base.metadata.create_all(bind=engine,checkfirst=True)

app = FastAPI(
    title       = "Industrix",
    description = "Market simulation game backend — Jadavpur University Production Engineering",
    version     = "2.0.0",
    docs_url    = None,
    redoc_url   = None,
)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Team-facing routers
app.include_router(team_auth.router)
app.include_router(team_procurement.router)
app.include_router(team_production.router)
app.include_router(team_sales.router)
app.include_router(team_leaderboard.router)
app.include_router(team_inventory.router)
app.include_router(team_events.router)
app.include_router(team_briefing.router)

# Organiser routers
app.include_router(org_cycle.router)
app.include_router(org_deals.router)
app.include_router(org_teams.router)
app.include_router(org_aucts.router)
app.include_router(org_marks.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status" : "hello"}

@app.get("", tags=["meta"])
def root():
    return {"status": "Alive!"}

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="/static/swagger-ui-bundle.js",
        swagger_css_url="/static/swagger-ui.css",
        swagger_favicon_url="/static/favicon.png",
    )

@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=app.title + " - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js",
    )