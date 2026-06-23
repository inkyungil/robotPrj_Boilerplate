from typing import cast

from fastapi import APIRouter

from app.core.bridge import bridge
from app.drivers.driving_driver import DrivingDriver
from app.schemas.driving import MoveRequest, RotateRequest

router = APIRouter()


def _driver() -> DrivingDriver:
    return cast(DrivingDriver, bridge.driver)


# /status · /stop · /home 은 공통 라우터(common.py)로 이동했다.


@router.post("/move")
def move(req: MoveRequest):
    """직선 이동"""
    return _driver().move(req.direction, req.distance, req.speed)


@router.post("/rotate")
def rotate(req: RotateRequest):
    """제자리 회전"""
    return _driver().rotate(req.angle, req.speed)
