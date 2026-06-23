import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, Request, status, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_robot_db
from app.deps import get_current_admin
from app.models import Admin, Conversation, Message

router = APIRouter(prefix="/api/admin/chat", tags=["admin-chat"])

class ChatCommandReq(BaseModel):
    session_id: str
    user_message: str
    robot_type: str  # "mobile" | "arm"
    action: str      # e.g., "move", "stop", etc.
    parameters: Optional[Dict[str, Any]] = None

ROBOT_SERVER_URL = "http://127.0.0.1:9001"

def _call_local_api(path: str, headers: dict, data: Optional[dict] = None) -> tuple[bool, str]:
    url = f"{ROBOT_SERVER_URL}{path}"
    try:
        payload = json.dumps(data or {}).encode("utf-8")
        req_headers = {"Content-Type": "application/json"}
        if "Authorization" in headers:
            req_headers["Authorization"] = headers["Authorization"]
            
        req = urllib.request.Request(
            url,
            data=payload,
            headers=req_headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            return True, res_body
    except urllib.error.HTTPError as e:
        try:
            err_msg = e.read().decode("utf-8")
        except Exception:
            err_msg = e.reason
        return False, f"HTTP {e.code}: {err_msg}"
    except Exception as e:
        return False, str(e)

@router.post("/execute")
async def execute_chat_command(
    req: ChatCommandReq,
    request: Request,
    db: AsyncSession = Depends(get_robot_db),
    _admin: Admin = Depends(get_current_admin)
):
    # 1. Get or create conversation
    stmt = select(Conversation).where(Conversation.session_id == req.session_id)
    conversation = (await db.execute(stmt)).scalar_one_or_none()
    if not conversation:
        conversation = Conversation(
            session_id=req.session_id,
            title=req.user_message[:30] + "..." if len(req.user_message) > 30 else req.user_message
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    # 2. Add user message to DB
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.user_message
    )
    db.add(user_msg)
    await db.commit()

    # 3. Process execution
    path = ""
    body = {}

    if req.robot_type == "mobile":
        if req.action == "move":
            path = "/api/admin/robot/motor/move"
            body = {
                "left": int(req.parameters.get("left", 0)),
                "right": int(req.parameters.get("right", 0)),
                "duration": float(req.parameters.get("duration", 0.5))
            }
        elif req.action == "stop":
            path = "/api/admin/robot/motor/stop"
        elif req.action == "emotion":
            path = "/api/admin/robot/lcd/emotion"
            body = {"emotion": req.parameters.get("emotion", "basic")}
        elif req.action == "text":
            path = "/api/admin/robot/lcd/text"
            body = {
                "text": req.parameters.get("text", ""),
                "font_name": req.parameters.get("font_name", "default"),
                "font_size": int(req.parameters.get("font_size", 24)),
                "color": req.parameters.get("color", "#ffffff"),
                "bg_color": req.parameters.get("bg_color", "#000000"),
                "align": req.parameters.get("align", "center"),
                "scroll": bool(req.parameters.get("scroll", False)),
                "scroll_speed": int(req.parameters.get("scroll_speed", 3))
            }
        elif req.action == "buzzer":
            path = "/api/admin/robot/buzzer"
            body = {
                "preset": req.parameters.get("preset", "bell"),
                "count": int(req.parameters.get("count", 1)),
                "freq": int(req.parameters.get("freq", 1000)),
                "duration": float(req.parameters.get("duration", 0.2))
            }
    elif req.robot_type == "arm":
        if req.action == "home":
            path = "/api/arm/home"
        elif req.action == "stop":
            path = "/api/arm/stop"
        elif req.action == "jog-stop":
            path = "/api/arm/jog-stop"
        elif req.action == "angles":
            path = "/api/arm/angles"
            body = {
                "angles": req.parameters.get("angles", [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
                "speed": int(req.parameters.get("speed", 50))
            }
        elif req.action == "gripper":
            path = "/api/arm/gripper"
            body = {
                "angle": int(req.parameters.get("angle", 0))
            }
        elif req.action == "camera-view":
            path = "/api/arm/camera-view"
            body = {"preset": int(req.parameters.get("preset", 1))}
        elif req.action == "face-view":
            path = "/api/arm/face-view"
        elif req.action == "color-pick":
            path = "/api/arm/color-pick"
            body = {"color": req.parameters.get("color", "red")}
        elif req.action == "face-track":
            start = bool(req.parameters.get("start", True))
            path = f"/api/arm/face-track/{'start' if start else 'stop'}"
        elif req.action == "gesture":
            start = bool(req.parameters.get("start", True))
            path = f"/api/arm/gesture/{'start' if start else 'stop'}"
        elif req.action == "barcode-qr":
            start = bool(req.parameters.get("start", True))
            path = f"/api/arm/barcode-qr/{'start' if start else 'stop'}"
        elif req.action == "classify":
            start = bool(req.parameters.get("start", True))
            path = f"/api/arm/classify/{'start' if start else 'stop'}"
        elif req.action == "ocr":
            start = bool(req.parameters.get("start", True))
            path = f"/api/arm/ocr/{'start' if start else 'stop'}"

    # Extract auth header to proxy the request
    headers = {}
    auth_header = request.headers.get("Authorization")
    if auth_header:
        headers["Authorization"] = auth_header

    if path:
        success, response_text = _call_local_api(path, headers=headers, data=body)
    else:
        success = False
        response_text = f"Unknown action: {req.action} for robot type: {req.robot_type}"

    # 4. Add bot response to DB
    bot_msg_content = f"🤖 로봇 명령 실행 결과: {'성공' if success else '실패'}\n\n- 대상: {req.robot_type}\n- 동작: {req.action}\n- 상세: {response_text}"
    bot_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=bot_msg_content
    )
    db.add(bot_msg)
    await db.commit()

    return {
        "success": success,
        "response": response_text,
        "bot_message": bot_msg_content
    }

@router.get("/history")
async def get_chat_history(
    session_id: str,
    db: AsyncSession = Depends(get_robot_db),
    _admin: Admin = Depends(get_current_admin)
):
    stmt = select(Conversation).where(Conversation.session_id == session_id)
    conversation = (await db.execute(stmt)).scalar_one_or_none()
    if not conversation:
        return []
        
    stmt_msgs = select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc())
    rows = (await db.execute(stmt_msgs)).scalars().all()
    
    return [
        {
            "id": r.id,
            "role": r.role,
            "content": r.content,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in rows
    ]
