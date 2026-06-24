import os
import threading
import time
from typing import Any

import cv2
import numpy as np

try:
    from picamera2 import Picamera2
    from picamera2.encoders import MJPEGEncoder
    from picamera2.outputs import Output
    _PICAMERA2_AVAILABLE = True
except ImportError:
    _PICAMERA2_AVAILABLE = False
    Output = object  # type: ignore

# 프레임이 이 시간(초) 이상 갱신되지 않으면 캡처가 멈춘 것으로 보고 재시작한다.
_STALL_TIMEOUT = 5.0
# 분석(밝기/움직임/윤곽) 갱신 주기(초). 매 프레임 JPEG 디코드를 피하기 위한 스로틀.
_ANALYSIS_INTERVAL = 0.4


class _JpegSink(Output):
    """picamera2 하드웨어 MJPEG 인코더가 뱉는 JPEG 프레임을 매니저로 넘긴다."""

    def __init__(self, manager: "CameraManager") -> None:
        super().__init__()
        self._manager = manager

    def outputframe(self, frame, keyframe=True, timestamp=None, *args, **kwargs) -> None:
        self._manager._on_jpeg(bytes(frame))


class CameraManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cam_lock = threading.Lock()
        self._lifecycle_lock = threading.Lock()
        self._cam: "Picamera2 | None" = None
        self._cap: cv2.VideoCapture | None = None
        self._frame: bytes | None = None
        self._frame_id = 0
        self._analysis: dict[str, Any] | None = None
        self._prev_gray = None
        self._last_analysis_t = 0.0
        self._thread: threading.Thread | None = None
        self._watchdog: threading.Thread | None = None
        self._running = False
        self._error: str | None = None
        self._last_push = 0.0  # 마지막 프레임 갱신 시각 (time.monotonic)

    def start(self) -> None:
        with self._lifecycle_lock:
            if self._running:
                return
            self._error = None
            self._running = True
            self._last_push = time.monotonic()
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            if self._watchdog is None or not self._watchdog.is_alive():
                self._watchdog = threading.Thread(target=self._watchdog_loop, daemon=True)
                self._watchdog.start()

    def stop(self) -> None:
        with self._lifecycle_lock:
            self._running = False
            thread = self._thread
            self._thread = None
        self._close_devices()
        if thread:
            thread.join(timeout=5)
        with self._lock:
            self._frame = None
            self._frame_id = 0
            self._analysis = None
            self._prev_gray = None

    def _close_devices(self) -> None:
        """열린 카메라/캡처 디바이스를 닫는다."""
        with self._cam_lock:
            cam = self._cam
            self._cam = None
        if cam is not None:
            try:
                cam.stop_recording()
            except Exception:
                pass
            try:
                cam.close()
            except Exception:
                pass

        cap = self._cap
        self._cap = None
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass

    def _watchdog_loop(self) -> None:
        """프레임이 멈추거나 캡처 스레드가 죽으면 캡처를 재시작한다."""
        while self._running:
            time.sleep(1.0)
            if not self._running:
                break
            age = time.monotonic() - self._last_push
            alive = self._thread is not None and self._thread.is_alive()
            if not (age > _STALL_TIMEOUT or not alive):
                continue

            with self._lifecycle_lock:
                if not self._running:
                    break
                reason = "프레임 정지" if alive else "캡처 스레드 종료"
                self._error = f"카메라 {reason} 감지 ({age:.1f}s) — 캡처 재시작"
                old = self._thread
                self._thread = None
            self._close_devices()
            if old:
                old.join(timeout=5)
            with self._lifecycle_lock:
                if not self._running:
                    break
                self._last_push = time.monotonic()
                self._thread = threading.Thread(target=self._loop, daemon=True)
                self._thread.start()

    def is_running(self) -> bool:
        return self._running

    def get_jpeg(self) -> bytes | None:
        with self._lock:
            return self._frame

    def get_frame(self) -> tuple[int, bytes | None]:
        with self._lock:
            return self._frame_id, self._frame

    def get_analysis(self) -> dict[str, Any] | None:
        with self._lock:
            return self._analysis.copy() if self._analysis else None

    def get_debug_status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "frame_id": self._frame_id,
                "has_frame": self._frame is not None,
                "timestamp": self._analysis.get("timestamp") if self._analysis else None,
                "frame_age": round(time.monotonic() - self._last_push, 2) if self._last_push else None,
            }

    @property
    def error(self) -> str | None:
        return self._error

    def _analyze_frame(self, frame_bgr: np.ndarray) -> dict[str, Any]:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        mean_brightness = float(gray.mean())
        edges = cv2.Canny(gray, 80, 160)
        edge_density = float((edges > 0).mean())

        motion_score = 0.0
        if self._prev_gray is not None and self._prev_gray.shape == gray.shape:
            diff = cv2.absdiff(gray, self._prev_gray)
            motion_score = float((diff > 25).mean())
        self._prev_gray = gray

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        avg_rgb = frame_rgb.mean(axis=(0, 1))
        height, width = frame_bgr.shape[:2]
        return {
            "timestamp": time.time(),
            "width": width,
            "height": height,
            "brightness": round(mean_brightness, 2),
            "motion_score": round(motion_score, 4),
            "edge_density": round(edge_density, 4),
            "avg_rgb": [round(float(v), 2) for v in avg_rgb],
        }

    def _on_jpeg(self, jpeg: bytes) -> None:
        """하드웨어 인코더 콜백: JPEG을 그대로 저장하고, 분석은 스로틀해서 갱신."""
        now = time.time()
        analysis = None
        if now - self._last_analysis_t >= _ANALYSIS_INTERVAL:
            self._last_analysis_t = now
            frame = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
            if frame is not None:
                analysis = self._analyze_frame(frame)
        with self._lock:
            self._frame = jpeg
            self._frame_id += 1
            if analysis is not None:
                self._analysis = analysis
        self._last_push = time.monotonic()
        if self._error:  # 복구되어 프레임이 다시 흐르면 정지 에러 해제
            self._error = None

    def _apply_color_swap(self, frame_bgr: np.ndarray) -> np.ndarray:
        from app.config import settings
        mode = getattr(settings, "camera_color_swap", "none").lower()
        if mode == "rgb_bgr":
            return cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        elif mode == "yuv_uv":
            yuv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2YUV)
            yuv[:, :, [1, 2]] = yuv[:, :, [2, 1]]
            return cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
        return frame_bgr

    def _apply_camera_flip(self, frame_bgr: np.ndarray) -> np.ndarray:
        from app.config import settings
        mode = getattr(settings, "camera_flip", "none").lower()
        if mode == "vertical":
            return cv2.flip(frame_bgr, 0)
        elif mode == "horizontal":
            return cv2.flip(frame_bgr, 1)
        elif mode == "both":
            return cv2.flip(frame_bgr, -1)
        return frame_bgr

    def _push_frame(self, frame_bgr: np.ndarray) -> None:
        """V4L2(USB) 경로용: 소프트웨어로 방향/색 보정 후 JPEG 인코딩."""
        frame_bgr = self._apply_color_swap(frame_bgr)
        frame_bgr = self._apply_camera_flip(frame_bgr)

        analysis = self._analyze_frame(frame_bgr)
        ok, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            return

        with self._lock:
            self._frame = buf.tobytes()
            self._frame_id += 1
            self._analysis = analysis
        self._last_push = time.monotonic()
        if self._error:  # 복구되어 프레임이 다시 흐르면 정지 에러 해제
            self._error = None

    def _build_transform(self):
        """CAMERA_FLIP 설정을 picamera2 하드웨어 Transform 으로 변환."""
        from libcamera import Transform
        from app.config import settings
        mode = getattr(settings, "camera_flip", "none").lower()
        hflip = mode in ("horizontal", "both")
        vflip = mode in ("vertical", "both")
        return Transform(hflip=hflip, vflip=vflip)

    def _loop(self) -> None:
        if _PICAMERA2_AVAILABLE:
            self._loop_picamera2()
        else:
            self._loop_v4l2()

    def _loop_picamera2(self) -> None:
        # capture_array() 는 RPi 커널 ISP(bcm2835_isp) dmabuf vmap 버그로 수십 프레임 뒤
        # 영구 블록되므로, CPU vmap이 없는 하드웨어 MJPEG 인코더로 스트리밍한다.
        try:
            cam = Picamera2()
            config = cam.create_video_configuration(
                main={"size": (640, 480)},
                transform=self._build_transform(),
            )
            cam.configure(config)
            cam.start_recording(MJPEGEncoder(), _JpegSink(self))
            with self._cam_lock:
                self._cam = cam
            self._last_push = time.monotonic()
        except Exception as e:
            self._error = f"Picamera2를 열 수 없습니다: {e} - V4L2로 재시도합니다."
            self._loop_v4l2()
            return

        # 프레임은 인코더 콜백(_on_jpeg)으로 들어오므로 이 스레드는 살아만 있는다.
        try:
            while self._running:
                time.sleep(0.2)
        finally:
            with self._cam_lock:
                owned = (self._cam is cam)
                if owned:
                    self._cam = None
            if owned:
                try:
                    cam.stop_recording()
                except Exception:
                    pass
                try:
                    cam.close()
                except Exception:
                    pass

    def _loop_v4l2(self) -> None:
        from app.config import settings
        dev_str = getattr(settings, "camera_device", "0")

        # 디바이스 경로 또는 인덱스 판별
        if dev_str.isdigit():
            dev: int | str = int(dev_str)
        else:
            dev = dev_str

        if isinstance(dev, str) and not os.path.exists(dev):
            dev = 0

        cap = cv2.VideoCapture(dev)
        if not cap.isOpened():
            self._error = f"카메라를 열 수 없습니다 (V4L2): {dev}"
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        self._cap = cap
        self._last_push = time.monotonic()

        try:
            while self._running:
                ret, frame_bgr = cap.read()
                if not ret:
                    time.sleep(0.1)
                    continue
                self._push_frame(frame_bgr)
                time.sleep(0.01)
        except Exception as e:
            self._error = str(e)
        finally:
            if self._cap is cap:
                self._cap = None
            try:
                cap.release()
            except Exception:
                pass


camera = CameraManager()
