import asyncio

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from app.hardware.camera_stream import camera

router = APIRouter()


async def _mjpeg_generator(request: Request):
    last_frame_id = -1
    try:
        while not await request.is_disconnected():
            frame_id, jpeg = camera.get_frame()
            if jpeg and frame_id != last_frame_id:
                last_frame_id = frame_id
                header = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(jpeg)}\r\n".encode()
                    + b"Cache-Control: no-cache\r\n\r\n"
                )
                yield header + jpeg + b"\r\n"
            await asyncio.sleep(0.02)
    except (asyncio.CancelledError, GeneratorExit):
        pass


@router.get("/stream")
async def camera_stream(request: Request):
    if not camera.is_running():
        camera.start()
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


@router.get("/snapshot")
async def camera_snapshot():
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


@router.post("/start")
async def camera_start():
    if camera.is_running():
        return {"success": True, "message": "이미 실행 중"}
    camera.start()
    await asyncio.sleep(0.4)
    if camera.error:
        return {"success": False, "message": camera.error}
    return {"success": True, "message": "카메라 시작"}


@router.post("/stop")
async def camera_stop():
    camera.stop()
    return {"success": True, "message": "카메라 중지"}


@router.get("/status")
async def camera_status():
    return {
        "running": camera.is_running(),
        "error": camera.error,
        **camera.get_debug_status(),
    }
