import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

ADMIN_DATABASE_URL = os.getenv("ADMIN_DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR}/management.db")
ROBOT_DATABASE_URL = os.getenv("ROBOT_DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR}/robot.db")

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-use-a-long-random-string")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
