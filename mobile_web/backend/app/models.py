import enum
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class AdminRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"


class AdminUser(Base):
    """Admin account — used both for login and as the managed user list."""

    __tablename__ = "admin_users"
    # Convention: every MariaDB table/column carries a COMMENT (see CLAUDE.md).
    __table_args__ = {"comment": "관리자 계정: 로그인 및 관리자 목록 CRUD 대상"}

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, comment="기본키"
    )
    username: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, comment="로그인 아이디 (고유)"
    )
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, comment="이메일 (고유, 선택)"
    )
    full_name: Mapped[str | None] = mapped_column(
        String(128), nullable=True, comment="표시 이름"
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="bcrypt 해시된 비밀번호 (평문 저장 금지)"
    )
    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole),
        nullable=False,
        default=AdminRole.admin,
        comment="권한 등급: superadmin | admin",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, comment="활성 여부 (0=비활성, 1=활성)"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="마지막 로그인 시각"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="생성 시각"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="수정 시각 (자동 갱신)",
    )


class Book(Base):
    """Book catalog — used for chatbot recommendation and user search."""

    __tablename__ = "books"
    __table_args__ = {"comment": "도서 목록: 챗봇 추천 및 검색 대상"}

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, comment="기본키"
    )
    title_kr: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="도서 제목 (한국어)"
    )
    title_en: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="도서 제목 (영어)"
    )
    title_zh: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="도서 제목 (중국어)"
    )
    title_vi: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="도서 제목 (베트남어)"
    )
    author: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="저자명"
    )
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="도서 카테고리 (fiction | self | foreign | humanities | economy | poetry)"
    )
    cover: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="도서 표지 이모지"
    )
    color: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Tailwind 그라디언트 배경 클래스"
    )
    zone: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="도서관 내 구역 (예: A-2)"
    )
    shelf: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="서가 위치/줄 설명"
    )
    in_stock: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, comment="대출 가능 여부 (0=대출 중, 1=대출가능)"
    )
    summary_kr: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, comment="도서 요약 (한국어)"
    )
    summary_en: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, comment="도서 요약 (영어)"
    )
    summary_zh: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, comment="도서 요약 (중국어)"
    )
    summary_vi: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, comment="도서 요약 (베트남어)"
    )
    for_whom_kr: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="추천 대상/해시태그 JSON 배열 (한국어)"
    )
    for_whom_en: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="추천 대상/해시태그 JSON 배열 (영어)"
    )
    for_whom_zh: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="추천 대상/해시태그 JSON 배열 (중국어)"
    )
    for_whom_vi: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="추천 대상/해시태그 JSON 배열 (베트남어)"
    )


class Member(Base):
    """Mobile user account for logging in and ordering books."""

    __tablename__ = "members"
    __table_args__ = {"comment": "모바일 사용자 계정: 로그인 및 도서 주문 주체"}

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, comment="기본키"
    )
    username: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, comment="로그인 아이디 (고유)"
    )
    full_name: Mapped[str | None] = mapped_column(
        String(128), nullable=True, comment="사용자 이름"
    )
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, comment="이메일 (고유, 선택)"
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="bcrypt 해시된 비밀번호"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, comment="활성 여부 (0=비활성, 1=활성)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="가입 일시"
    )


class RobotTask(Base):
    """Task log for robots retrieving a book and delivering to shelf/counter."""

    __tablename__ = "robot_tasks"
    __table_args__ = {"comment": "로봇 호출 작업 내역: 도서 수거 및 진열대 전달 상태 관리"}

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, comment="기본키"
    )
    member_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="호출한 사용자(Member) 기본키"
    )
    book_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="대상 도서(Book) 기본키"
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="requested", comment="작업 상태: requested(요청됨) | moving(이동중) | retrieved(수거완료) | delivering(배송중) | completed(완료) | failed(실패)"
    )
    zone: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="대상 도서 구역 (예: A-2)"
    )
    shelf: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="대상 도서 서가 위치"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="호출 일시"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False, comment="상태 변경 일시"
    )


