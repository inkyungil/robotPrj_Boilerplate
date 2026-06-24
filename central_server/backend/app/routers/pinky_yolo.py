"""Pinky Pro object-detection API."""
import asyncio
import urllib.request

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.deps import get_current_admin
from app.hardware.camera_stream import camera
from app.hardware.pinky_yolo import pinky_yolo
from app.security import create_access_token

router = APIRouter(prefix="/api/arm/pinky-detect", tags=["pinky-yolo"])


class ConfidenceRequest(BaseModel):
    confidence: float = Field(ge=0.1, le=0.95)


@router.get("/status")
async def status() -> dict:
    return pinky_yolo.status()


@router.post("/confidence")
async def set_confidence(request: ConfidenceRequest) -> dict:
    pinky_yolo.set_confidence(request.confidence)
    return {"success": True, "confidence": pinky_yolo.confidence}


@router.post("/analyze")
async def analyze_frame(
    file: UploadFile = File(...),
    _=Depends(get_current_admin),
) -> dict:
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(400, "이미지 파일만 업로드 가능합니다")
    payload = await file.read()
    result = pinky_yolo.detect_jpeg(payload)
    if result is None:
        raise HTTPException(400, "이미지 프레임을 해석하지 못했습니다")
    return result


def fetch_remote_frame(ip: str) -> bytes | None:
    token = create_access_token("admin")
    url = f"http://{ip}:9001/api/admin/robot/camera/snapshot?token={token}"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as response:
            return response.read()
    except Exception:
        return None


@router.websocket("/ws")
async def detection_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    robot_ip = websocket.query_params.get("robot_ip")
    if not robot_ip:
        if not camera.is_running():
            camera.start()
    try:
        while True:
            if robot_ip:
                jpeg = await asyncio.to_thread(fetch_remote_frame, robot_ip)
                if jpeg:
                    payload = await asyncio.to_thread(pinky_yolo.detect_jpeg, jpeg)
                else:
                    payload = {"type": "error", "message": f"로봇({robot_ip}) 카메라에서 프레임을 가져오지 못했습니다."}
            else:
                payload = await asyncio.to_thread(pinky_yolo.detect_latest)

            if payload is not None:
                await websocket.send_json(payload)
                if payload.get("type") == "error":
                    await asyncio.sleep(1)
            await asyncio.sleep(0.03)
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
