from pydantic import BaseModel, Field
from typing import List


class JogRequest(BaseModel):
    joint: int = Field(..., ge=0, le=5, description="관절 인덱스 (0~5)")
    delta: float = Field(..., description="이동 각도 (degree)")


class GripperRequest(BaseModel):
    position: float = Field(..., ge=0.0, le=1.0, description="0.0 완전 닫힘, 1.0 완전 열림")


class JointState(BaseModel):
    joints: List[float] = Field(..., description="6축 관절 각도 (degree)")
    gripper: float = Field(..., description="그리퍼 위치")
