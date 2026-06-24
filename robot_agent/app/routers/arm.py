from typing import cast

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.bridge import bridge
from app.drivers.arm_driver import ArmDriver
from app.schemas.arm import GripperRequest, JogRequest

router = APIRouter()


def _driver() -> ArmDriver:
    return cast(ArmDriver, bridge.driver)


# ── Pydantic 스키마 정의 (중앙 서버와 스펙 호환) ──────────────────────────

class JointReq(BaseModel):
    angles: list[float]   # J1~J6 각도 (degrees)
    speed: int = 20

class GripperReq(BaseModel):
    value: int            # 0=닫힘 ~ 100=열림
    speed: int = 20


# ── 로봇팔 제어 엔드포인트 ──────────────────────────────────────────────────

@router.get("/state")
def get_state():
    """현재 로봇팔 관절 및 그리퍼 상태 반환"""
    return _driver().get_status()


@router.post("/angles")
def set_angles(req: JointReq):
    """지정된 각도로 모든 관절 동시 이동"""
    return _driver().send_angles(req.angles, req.speed)


@router.post("/gripper")
def set_gripper_value(req: GripperReq):
    """그리퍼 개폐 제어 (0 ~ 100 값 지정)"""
    return _driver().set_gripper_value(req.value, req.speed)


@router.post("/stop")
def stop():
    """긴급 정지"""
    return _driver().stop()


@router.post("/home")
def home():
    """홈 포지션 복귀"""
    return _driver().home()


@router.post("/jog-stop")
def jog_stop():
    """조그 이동 즉시 정지"""
    return _driver().jog_stop()


# ── 특정 카메라/얼굴 추적 뷰 포지션 이동 (프리셋) ──────────────────────────────────

@router.post("/face-view")
def face_view():
    """얼굴 추적 뷰 포지션으로 이동"""
    FACE_VIEW_ANGLES = [0.0, 0.0, -90.0, 90.0, 0.0, 0.0]
    return _driver().send_angles(FACE_VIEW_ANGLES, 40)


@router.post("/camera-view")
def camera_view():
    """기본 카메라 뷰 포지션으로 이동"""
    CAMERA_VIEW_ANGLES = [2.3, -1.7, -15.8, -66.7, -1.2, -3.6]
    return _driver().send_angles(CAMERA_VIEW_ANGLES, 40)


# ── 볼트 조작용 조그 및 단일 제어 (에이전트 고유 API 유지) ──────────────────────────

@router.post("/jog")
def jog(req: JogRequest):
    """단일 관절 조그 이동"""
    return _driver().jog(req.joint, req.delta)


@router.post("/gripper-legacy")
def set_gripper_legacy(req: GripperRequest):
    """기존 position (0.0~1.0) 기반 그리퍼 제어 지원"""
    return _driver().set_gripper(req.position)
