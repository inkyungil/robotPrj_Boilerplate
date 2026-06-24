from pathlib import Path

from fastapi import APIRouter

FONTS_DIR = Path("/home/bot_ai_server/backend/app/hardware/uploads/fonts")

router = APIRouter(prefix="/admin/robot")


@router.get("/lcd/fonts")
def list_fonts():
    if not FONTS_DIR.exists():
        return {"fonts": []}
    exts = {".ttf", ".otf"}
    files = sorted(f.name for f in FONTS_DIR.iterdir() if f.suffix.lower() in exts)
    return {"fonts": files}
