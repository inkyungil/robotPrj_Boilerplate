from typing import Optional

from app.core.ros_node import RosNode
from app.drivers.base import BaseDriver
from app.schemas.arm import JointState


class ArmDriver(BaseDriver):
    """JetCobot 관절·그리퍼 제어 (pymycobot).

    pymycobot 는 arm PC 에서만 필요하므로 start() 안에서 lazy import 한다.
    실제 시리얼 연결 파라미터(포트/보레이트)는 환경에 맞게 채운다.
    """

    def start(self, ros_node: Optional[RosNode] = None) -> None:
        super().start(ros_node)
        self._mc = None
        # 실제 하드웨어 연결 예시 (환경에 맞게 활성화):
        # from pymycobot import MyCobot
        # self._mc = MyCobot("/dev/ttyAMA0", 1000000)

    def shutdown(self) -> None:
        self._mc = None

    def get_status(self) -> dict:
        if self._mc is not None:
            joints = self._mc.get_angles() or [0.0] * 6
            gripper = float(self._mc.get_gripper_value() or 0)
            return JointState(joints=joints, gripper=gripper).model_dump()
        return JointState(joints=[0.0] * 6, gripper=0.0).model_dump()

    def jog(self, joint: int, delta: float) -> dict:
        # if self._mc is not None:
        #     self._mc.jog_angle(joint, 1 if delta > 0 else 0, abs(delta))
        return {"joint": joint, "delta": delta}

    def set_gripper(self, position: float) -> dict:
        # if self._mc is not None:
        #     self._mc.set_gripper_value(int(position * 100), 50)
        return {"gripper": position}

    def home(self) -> dict:
        # if self._mc is not None:
        #     self._mc.send_angles([0, 0, 0, 0, 0, 0], 50)
        return {"result": "homing"}

    def stop(self) -> dict:
        # if self._mc is not None:
        #     self._mc.stop()
        return {"result": "stopped"}
