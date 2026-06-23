from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Member
from ..schemas import MemberCreate, MemberOut, MemberTokenResponse, LoginRequest
from ..security import create_access_token, get_current_member, verify_password, hash_password

router = APIRouter(prefix="/api/member/auth", tags=["member_auth"])


@router.post("/register", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def register(data: MemberCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Member).where(Member.username == data.username))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 존재하는 사용자 아이디입니다.",
        )
    
    if data.email:
        existing_email = db.scalar(select(Member).where(Member.email == data.email))
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 존재하는 이메일 주소입니다.",
            )
    
    member = Member(
        username=data.username,
        full_name=data.full_name or data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.post("/login", response_model=MemberTokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    member = db.scalar(select(Member).where(Member.username == data.username))
    if member is None or not verify_password(data.password, member.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )
    if not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다. 관리자에게 문의하세요.",
        )

    token = create_access_token(str(member.id))
    return MemberTokenResponse(access_token=token, member=MemberOut.model_validate(member))


@router.get("/me", response_model=MemberOut)
def me(current: Member = Depends(get_current_member)):
    return current
