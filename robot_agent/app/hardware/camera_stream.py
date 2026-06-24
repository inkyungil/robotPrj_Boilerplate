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


class CameraManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cam_lock = threading.Lock()
        self._cam: "Picamera2 | None" = None
        self._cap: cv2.VideoCapture | None = None
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
        with self._cam_lock:
            cam = self._cam
            self._cam = None
        if cam is not None:
            try:
                cam.stop()
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

        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
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
        # 카메라가 180도 뒤집혀 장착되어 있으므로 회전 보정
        frame_bgr = cv2.rotate(frame_bgr, cv2.ROTATE_180)
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
            with self._cam_lock:
                self._cam = cam
        except Exception as e:
            self._error = f"Picamera2를 열 수 없습니다: {e} - V4L2로 재시도합니다."
            self._loop_v4l2()
            return

        # 첫 프레임 안정화 대기
        time.sleep(0.3)

        try:
            while self._running:
                try:
                    frame_bgr = cam.capture_array()
                except Exception as e:
                    self._error = str(e)
                    break

                self._push_frame(frame_bgr)
                time.sleep(0.033)  # ~30 fps
        except Exception as e:
            self._error = str(e)
        finally:
            with self._cam_lock:
                owned = (self._cam is cam)
                if owned:
                    self._cam = None
            if owned:
                try:
                    cam.stop()
                    cam.close()
                except Exception:
                    pass
            self._running = False

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
                time.sleep(0.01)
        except Exception as e:
            self._error = str(e)
        finally:
            cap.release()
            self._cap = None
            self._running = False


camera = CameraManager()
