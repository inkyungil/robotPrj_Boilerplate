from typing import Optional

from app.core.ros_node import RosNode
from app.drivers.base import BaseDriver
from app.schemas.driving import DriveState


class DrivingDriver(BaseDriver):
    """Pinky 주행 제어 (ROS2 navigation).

    RosNode 가 띄운 rclpy 노드를 통해 cmd_vel publish / odom subscribe 한다.
    geometry_msgs 등 ROS 메시지 import 는 노드가 살아있는 환경에서만 필요하므로
    start() 안에서 지연 import 한다.
    """

    def start(self, ros_node: Optional[RosNode] = None) -> None:
        super().start(ros_node)
        self._cmd_pub = None
        self._last_state = DriveState(x=0.0, y=0.0, heading=0.0, speed=0.0)
        # 실제 토픽 연결 예시 (ros_node 활성 시):
        # from geometry_msgs.msg import Twist
        # if ros_node and ros_node.node:
        #     self._cmd_pub = ros_node.node.create_publisher(Twist, "/cmd_vel", 10)

    def get_status(self) -> dict:
        return self._last_state.model_dump()

    def move(self, direction: str, distance: float, speed: float) -> dict:
        # Twist 메시지 publish 또는 Nav2 액션 호출
        return {"direction": direction, "distance": distance, "speed": speed}

    def rotate(self, angle: float, speed: float) -> dict:
        return {"angle": angle, "speed": speed}

    def home(self) -> dict:
        return {"result": "homing"}

    def stop(self) -> dict:
        # zero Twist publish
        return {"result": "stopped"}
