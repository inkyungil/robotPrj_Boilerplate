import os
import threading
import time
from typing import Any

import cv2
import numpy as np

try:
    from picamera2 import Picamera2
    _PICAMERA2_AVAILABLE = True
except ImportError:
    _PICAMERA2_AVAILABLE = False

# V4L2 폴백용 디바이스
_CAMERA_DEVICE_ENV = os.getenv("CAMERA_DEVICE")
if _CAMERA_DEVICE_ENV:
    _V4L2_DEVICE: int | str = int(_CAMERA_DEVICE_ENV) if _CAMERA_DEVICE_ENV.isdigit() else _CAMERA_DEVICE_ENV
else:
    _default = "/dev/jetcocam0"
    _V4L2_DEVICE = _default if os.path.exists(_default) else 0


class CameraManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cam = None  # Picamera2 인스턴스 (picamera2 모드일 때)
        self._cap: cv2.VideoCapture | None = None  # V4L2 모드일 때
        self._frame: bytes | None = None
        self._frame_id = 0
        self._analysis: dict[str, Any] | None = None
        self._prev_gray = None
        self._thread: threading.Thread | None = None
        self._running = False
        self._error: str | None = None

    def start(self) -> None:
        if self._running:
            return
        self._error = None
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        if self._cap:
            self._cap.release()
            self._cap = None
        with self._lock:
            self._frame = None
            self._frame_id = 0
            self._analysis = None
            self._prev_gray = None

    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

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
        if self._prev_gray is not None:
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

    def _loop(self) -> None:
        if _PICAMERA2_AVAILABLE:
            self._loop_picamera2()
        else:
            self._loop_v4l2()

    def _loop_picamera2(self) -> None:
        try:
            cam = Picamera2()
            config = cam.create_preview_configuration(
                main={"size": (640, 480), "format": "RGB888"}
            )
            cam.configure(config)
            cam.start()
            self._cam = cam
        except Exception as e:
            self._error = f"picamera2 열기 실패, V4L2로 재시도합니다: {e}"
            self._loop_v4l2()
            return

        time.sleep(0.3)
        try:
            while self._running:
                try:
                    frame_rgb = cam.capture_array()
                except Exception as e:
                    self._error = str(e)
                    break
                # RGB888 → BGR
                frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
                self._push_frame(frame_bgr)
                time.sleep(0.033)
        except Exception as e:
            self._error = str(e)
        finally:
            try:
                cam.stop()
                cam.close()
            except Exception:
                pass
            self._cam = None
            self._running = False

    def _loop_v4l2(self) -> None:
        cap = cv2.VideoCapture(_V4L2_DEVICE)
        if not cap.isOpened():
            self._error = f"카메라를 열 수 없습니다: {_V4L2_DEVICE}"
            self._running = False
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        self._cap = cap

        try:
            while self._running:
                ret, frame_bgr = cap.read()
                if not ret:
                    time.sleep(0.1)
                    continue
                self._push_frame(frame_bgr)
        except Exception as e:
            self._error = str(e)
        finally:
            cap.release()
            self._cap = None
            self._running = False

    def _apply_color_swap(self, frame_bgr: np.ndarray) -> np.ndarray:
        import os
        mode = os.getenv("CAMERA_COLOR_SWAP", "none").lower()
        if mode == "rgb_bgr":
            return cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        elif mode == "yuv_uv":
            yuv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2YUV)
            yuv[:, :, [1, 2]] = yuv[:, :, [2, 1]]
            return cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
        return frame_bgr

    def _apply_camera_flip(self, frame_bgr: np.ndarray) -> np.ndarray:
        import os
        mode = os.getenv("CAMERA_FLIP", "none").lower()
        if mode == "vertical":
            return cv2.flip(frame_bgr, 0)
        elif mode == "horizontal":
            return cv2.flip(frame_bgr, 1)
        elif mode == "both":
            return cv2.flip(frame_bgr, -1)
        return frame_bgr

    def _push_frame(self, frame_bgr: np.ndarray) -> None:
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


camera = CameraManager()
