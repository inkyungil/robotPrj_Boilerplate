from fastapi import APIRouter
from app.schemas.arm import JogRequest, GripperRequest, JointState

router = APIRouter()


@router.get("/status", response_model=JointState)
def get_status():
    """현재 관절 상태 조회"""
    return JointState(joints=[0.0] * 6, gripper=0.0)


@router.post("/jog")
def jog(req: JogRequest):
    """단일 관절 조그 이동"""
    return {"joint": req.joint, "delta": req.delta}


@router.post("/gripper")
def set_gripper(req: GripperRequest):
    """그리퍼 개폐 제어"""
    return {"gripper": req.position}


@router.post("/home")
def go_home():
    """홈 포지션 이동"""
    return {"result": "homing"}


@router.post("/stop")
def stop():
    """즉시 정지"""
    return {"result": "stopped"}
