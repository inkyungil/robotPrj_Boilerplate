from fastapi import FastAPI
from app.routers import driving

app = FastAPI(title="Robot Driving API", version="0.1.0")

app.include_router(driving.router, prefix="/driving", tags=["driving"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
