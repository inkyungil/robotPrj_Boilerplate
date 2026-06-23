from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import auth, books, dashboard, dev, users, members, robot

settings = get_settings()

# Serve OpenAPI/Swagger under the same-origin /api prefix so nginx proxies them
# and the Dev Center "API 문서" page can embed /api/docs.
app = FastAPI(
    title="RobotChatAI Admin API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(dev.router)
app.include_router(books.router)
app.include_router(members.router)
app.include_router(robot.router)




@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
