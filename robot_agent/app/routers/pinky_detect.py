from pathlib import Path

from fastapi import APIRouter

MODEL_PATH = Path("/home/bot_ai_server/backend/models/pinky_best.pt")
DATASET_PATH = Path("/home/bot_ai_server/backend/pinky.v1i.yolov8/data.yaml")

router = APIRouter(prefix="/api/arm/pinky-detect")


@router.get("/status")
def status():
    return {
        "available": MODEL_PATH.exists(),
        "loaded": False,
        "model_path": str(MODEL_PATH),
        "dataset_path": str(DATASET_PATH),
        "classes": ["human", "pinky_63"],
        "confidence": 0.7,
        "error": None,
        "last_result": None,
    }
