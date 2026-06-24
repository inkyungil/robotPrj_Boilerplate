"""Pinky Pro YOLO inference service."""
from __future__ import annotations

import base64
import threading
import time
from typing import Any

import cv2
import numpy as np

from app.config import BASE_DIR
from app.hardware.camera_stream import camera

MODEL_PATH = BASE_DIR / "models" / "pinky_best.pt"
DATASET_PATH = BASE_DIR / "pinky.v1i.yolov8" / "data.yaml"


class PinkyYoloService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None
        self._error: str | None = None
        self._confidence = 0.7
        self._last_frame_id = -1
        self._last_result: dict[str, Any] | None = None

    @property
    def confidence(self) -> float:
        return self._confidence

    def set_confidence(self, value: float) -> None:
        self._confidence = max(0.1, min(0.95, float(value)))

    def load_model(self) -> bool:
        with self._lock:
            if self._model is not None:
                return True
            if not MODEL_PATH.exists():
                self._error = f"학습 모델이 없습니다: {MODEL_PATH}"
                return False
            try:
                from ultralytics import YOLO

                self._model = YOLO(str(MODEL_PATH))
                self._error = None
                return True
            except Exception as exc:
                self._error = f"YOLO 모델 로드 실패: {exc}"
                return False

    def _predict_frame(self, frame: np.ndarray) -> dict[str, Any] | None:
        if not self.load_model():
            return {"type": "error", "message": self._error}

        started = time.perf_counter()
        try:
            result = self._model.predict(frame, conf=self._confidence, verbose=False)[0]
            detections: list[dict[str, Any]] = []
            if result.boxes is not None:
                for box in result.boxes:
                    cls_id = int(box.cls[0].item())
                    score = float(box.conf[0].item())
                    x1, y1, x2, y2 = [round(float(v), 1) for v in box.xyxy[0].tolist()]
                    detections.append({
                        "class_id": cls_id,
                        "label": str(result.names[cls_id]),
                        "confidence": round(score, 4),
                        "box": [x1, y1, x2, y2],
                    })

            rendered = result.plot()
            ok, buffer = cv2.imencode(".jpg", rendered, [cv2.IMWRITE_JPEG_QUALITY, 75])
            if not ok:
                return None
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            payload = {
                "type": "detection",
                "frame": base64.b64encode(buffer.tobytes()).decode(),
                "detections": detections,
                "inference_ms": elapsed_ms,
                "timestamp": time.time(),
            }
            self._last_result = {key: value for key, value in payload.items() if key != "frame"}
            return payload
        except Exception as exc:
            self._error = f"YOLO 추론 실패: {exc}"
            return {"type": "error", "message": self._error}

    def detect_frame(self, frame: np.ndarray) -> dict[str, Any] | None:
        return self._predict_frame(frame)

    def detect_jpeg(self, jpeg: bytes) -> dict[str, Any] | None:
        frame = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            return None
        return self._predict_frame(frame)

    def status(self) -> dict[str, Any]:
        return {
            "available": MODEL_PATH.exists(),
            "loaded": self._model is not None,
            "model_path": str(MODEL_PATH),
            "dataset_path": str(DATASET_PATH),
            "classes": ["human", "pinky_63"],
            "confidence": self._confidence,
            "error": self._error,
            "last_result": self._last_result,
        }

    def detect_latest(self) -> dict[str, Any] | None:
        frame_id, jpeg = camera.get_frame()
        if jpeg is None or frame_id == self._last_frame_id:
            return None
        self._last_frame_id = frame_id
        return self.detect_jpeg(jpeg)


pinky_yolo = PinkyYoloService()
