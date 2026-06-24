from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import RobotType, settings
from app.core.bridge import bridge
from app.core.ros_node import RosNode
from app.drivers import create_driver


@asynccontextmanager
async def lifespan(app: FastAPI):
    """기동/종료 훅: 드라이버 생성, (필요 시) rclpy 노드 spin, 정리."""
    ros_node = None
    if settings.robot_type is RobotType.driving:
        ros_node = RosNode(settings.ros_node_name)
        ros_node.start()

    driver = create_driver(settings.robot_type)
    driver.start(ros_node=ros_node)
    bridge.set_driver(driver)

    try:
        yield
    finally:
        driver.shutdown()
        if ros_node is not None:
            ros_node.shutdown()


def create_app() -> FastAPI:
    """ROBOT_TYPE 에 맞는 라우터만 장착한 FastAPI 앱을 만든다."""
    app = FastAPI(
        title=f"Robot Agent ({settings.robot_type.value})",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 공통 라우터 (타입 무관)
    from app.routers import camera, common

    app.include_router(common.router, tags=["common"])
    app.include_router(camera.router, prefix="/camera", tags=["camera"])

    # 타입별 라우터 (활성 타입만 노출)
    if settings.robot_type is RobotType.arm:
        from app.routers import arm

        app.include_router(arm.router, prefix="/arm", tags=["arm"])
    elif settings.robot_type is RobotType.driving:
        from app.routers import driving

        app.include_router(driving.router, prefix="/driving", tags=["driving"])

    return app
