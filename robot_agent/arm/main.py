from fastapi import FastAPI
from app.routers import arm

app = FastAPI(title="Robot Arm API", version="0.1.0")

app.include_router(arm.router, prefix="/arm", tags=["arm"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
