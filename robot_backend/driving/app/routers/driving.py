from fastapi import APIRouter
from app.schemas.driving import MoveRequest, RotateRequest, DriveState

router = APIRouter()


@router.get("/status", response_model=DriveState)
def get_status():
    """현재 주행 상태 조회"""
    return DriveState(x=0.0, y=0.0, heading=0.0, speed=0.0)


@router.post("/move")
def move(req: MoveRequest):
    """직선 이동"""
    return {"direction": req.direction, "distance": req.distance, "speed": req.speed}


@router.post("/rotate")
def rotate(req: RotateRequest):
    """제자리 회전"""
    return {"angle": req.angle, "speed": req.speed}


@router.post("/stop")
def stop():
    """즉시 정지"""
    return {"result": "stopped"}


@router.post("/home")
def go_home():
    """홈 포지션 복귀"""
    return {"result": "homing"}
