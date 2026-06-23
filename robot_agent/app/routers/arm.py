from typing import cast

from fastapi import APIRouter

from app.core.bridge import bridge
from app.drivers.arm_driver import ArmDriver
from app.schemas.arm import GripperRequest, JogRequest

router = APIRouter()


def _driver() -> ArmDriver:
    return cast(ArmDriver, bridge.driver)


# /status · /stop · /home 은 공통 라우터(common.py)로 이동했다.


@router.post("/jog")
def jog(req: JogRequest):
    """단일 관절 조그 이동"""
    return _driver().jog(req.joint, req.delta)


@router.post("/gripper")
def set_gripper(req: GripperRequest):
    """그리퍼 개폐 제어"""
    return _driver().set_gripper(req.position)
