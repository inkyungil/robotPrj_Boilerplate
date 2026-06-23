import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse

from app.deps import get_current_admin
from app.hardware.camera_stream import camera
from app.security import decode_token

router = APIRouter(prefix="/api/admin/robot", tags=["camera"])


def _validate_stream_token(token: str) -> bool:
    """MJPEG 스트림 엔드포인트 전용 토큰 검증 (쿼리 파라미터)."""
    try:
        decode_token(token)
        return True
    except ValueError:
        return False


async def _mjpeg_generator(request: Request):
    last_frame_id = -1
    try:
        while not await request.is_disconnected():
            frame_id, jpeg = camera.get_frame()
            if jpeg and frame_id != last_frame_id:
                last_frame_id = frame_id
                headers = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(jpeg)}\r\n".encode()
                    + b"Cache-Control: no-cache\r\n\r\n"
                )
                yield headers + jpeg + b"\r\n"
            await asyncio.sleep(0.02)
    except (asyncio.CancelledError, GeneratorExit):
        pass


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/camera/stream")
async def camera_stream(request: Request, token: str = Query(...)):
    """MJPEG 스트리밍 — <img> 태그는 헤더를 보낼 수 없어 쿼리 파라미터로 인증."""
    if not _validate_stream_token(token):
        raise HTTPException(401, "인증 실패")
    if not camera.is_running():
        camera.start()
    # 첫 프레임이 준비될 때까지 최대 15초 대기
    for _ in range(300):
        if camera.get_jpeg() is not None:
            break
        await asyncio.sleep(0.05)
    else:
        raise HTTPException(503, "카메라 프레임을 받지 못했습니다")
    return StreamingResponse(
        _mjpeg_generator(request),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/camera/snapshot")
async def camera_snapshot(token: str = Query(...)):
    """최신 JPEG 한 장 반환. 프록시/MJPEG 렌더링이 불안정한 화면 갱신용."""
    if not _validate_stream_token(token):
        raise HTTPException(401, "인증 실패")
    if not camera.is_running():
        camera.start()
    for _ in range(60):
        jpeg = camera.get_jpeg()
        if jpeg is not None:
            return Response(
                content=jpeg,
                media_type="image/jpeg",
                headers={
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                },
            )
        await asyncio.sleep(0.05)
    raise HTTPException(503, "카메라 프레임을 받지 못했습니다")


@router.post("/camera/start")
async def camera_start(_=Depends(get_current_admin)):
    if camera.is_running():
        return {"success": True, "message": "이미 실행 중"}
    camera.start()
    await asyncio.sleep(0.4)
    if camera.error:
        return {"success": False, "message": camera.error}
    return {"success": True, "message": "카메라 시작"}


@router.post("/camera/stop")
async def camera_stop(_=Depends(get_current_admin)):
    camera.stop()
    return {"success": True, "message": "카메라 중지"}


@router.get("/camera/status")
async def camera_status(_=Depends(get_current_admin)):
    return {
        "running": camera.is_running(),
        "error": camera.error,
        **camera.get_debug_status(),
    }


@router.get("/camera/analysis")
async def camera_analysis(_=Depends(get_current_admin)):
    if not camera.is_running():
        camera.start()
    for _ in range(60):
        analysis = camera.get_analysis()
        if analysis is not None:
            return analysis
        if camera.error:
            raise HTTPException(503, camera.error)
        await asyncio.sleep(0.05)
    raise HTTPException(503, "카메라 분석 데이터가 아직 준비되지 않았습니다")
