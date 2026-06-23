from fastapi import APIRouter

router = APIRouter()


@router.get("/info")
def camera_info():
    """카메라 메타데이터 (해상도/FPS 등). 실제 송출 연동 전 placeholder."""
    return {"available": False, "stream": "/camera/stream"}


# TODO: MJPEG 또는 WebRTC 송출 엔드포인트 연동
# @router.get("/stream")
# def stream():
#     return StreamingResponse(frame_generator(),
#         media_type="multipart/x-mixed-replace; boundary=frame")
