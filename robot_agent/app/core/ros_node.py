import threading
from typing import Optional


class RosNode:
    """rclpy 노드를 별도 스레드에서 spin 시키는 래퍼.

    rclpy 는 driving 타입에서만 필요하므로 모든 import 를 메서드 안으로
    지연(lazy)시킨다. arm PC(ROS2 미설치)에서는 인스턴스를 만들지 않으면
    rclpy 를 전혀 건드리지 않는다.
    """

    def __init__(self, node_name: str = "robot_agent") -> None:
        self.node_name = node_name
        self._node = None
        self._executor = None
        self._thread: Optional[threading.Thread] = None

    @property
    def node(self):
        return self._node

    def start(self) -> None:
        import rclpy
        from rclpy.executors import SingleThreadedExecutor
        from rclpy.node import Node

        rclpy.init()
        self._node = Node(self.node_name)
        self._executor = SingleThreadedExecutor()
        self._executor.add_node(self._node)

        self._thread = threading.Thread(target=self._executor.spin, daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        import rclpy

        if self._executor is not None:
            self._executor.shutdown()
        if self._node is not None:
            self._node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
