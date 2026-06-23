# Labi Bot Backend

FastAPI 기반 관리자 API 서버입니다. SQLite와 SQLAlchemy async를 사용하며 로봇 하드웨어 제어도 함께 제공합니다.

## 스택

| 항목 | 내용 |
|------|------|
| 런타임 | Python 3.12 |
| 프레임워크 | FastAPI 0.115 |
| DB | SQLite (`management.db`, `robot.db`) |
| ORM | SQLAlchemy 2.0 async |
| 인증 | JWT + bcrypt |
| 서버 | Uvicorn |

## 디렉토리 구조

```text
backend/
├── main.py                  # 앱 진입점, 라우터 등록, 시드
├── requirements.txt
├── management.db            # 관리용 SQLite DB (회원, 로봇 레지스트리)
├── robot.db                 # 로봇용 SQLite DB (대화, LCD 이미지 등)
└── app/
    ├── config.py            # 환경변수 / 설정
    ├── database.py          # SQLAlchemy 엔진, 세션
    ├── models.py            # ORM 모델
    ├── schemas.py           # Pydantic 스키마
    ├── security.py          # 비밀번호 해시, JWT
    ├── deps.py              # FastAPI 의존성
    ├── hardware/            # 로봇 하드웨어 제어 스크립트
    └── routers/
        ├── auth.py          # 로그인, 현재 관리자
        ├── dashboard.py     # 대시보드 통계
        ├── users.py         # 관리자 CRUD
        ├── robot.py         # LCD, LED, 센서, 모터, 부저
        ├── camera.py        # 카메라 snapshot, status, analysis
        └── dev.py           # 테이블, ERD
```

## 빠른 시작

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 9001
```

첫 실행 시 `management.db`와 `robot.db`가 자동 생성되며 기본 superadmin 계정이 생성됩니다.

| 항목 | 값 |
|------|----|
| 기본 계정 | `admin` / `admin1234` |
| API 베이스 | `http://192.168.0.43:9001` |
| API 문서 | `http://192.168.0.43:9001/docs` |

## 주요 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/health` | 헬스체크 | 불필요 |
| POST | `/api/admin/auth/login` | 로그인, JWT 반환 | 불필요 |
| GET | `/api/admin/auth/me` | 내 정보 조회 | Bearer |
| GET | `/api/admin/dashboard/stats` | 대시보드 통계 | Bearer |
| GET | `/api/admin/users` | 관리자 목록 | Bearer |
| POST | `/api/admin/users` | 관리자 추가 | superadmin |
| PUT | `/api/admin/users/{id}` | 관리자 수정 | Bearer |
| DELETE | `/api/admin/users/{id}` | 관리자 삭제 | superadmin |
| GET | `/api/admin/robot/lcd/images` | LCD 이미지 목록 | Bearer |
| POST | `/api/admin/robot/lcd/image` | LCD 이미지 업로드 | Bearer |
| POST | `/api/admin/robot/lcd/image/select` | LCD 이미지 표시 | Bearer |
| DELETE | `/api/admin/robot/lcd/images/{name}` | LCD 이미지 삭제 | Bearer |
| GET | `/api/admin/robot/buzzer/status` | 부저 재생 상태 | Bearer |
| POST | `/api/admin/robot/buzzer/melody/play` | 멜로디 재생 | Bearer |
| POST | `/api/admin/robot/buzzer/melody/stop` | 멜로디 정지 | Bearer |
| GET | `/api/admin/robot/sensor/ir` | IR 센서 읽기 | Bearer |
| GET | `/api/admin/robot/sensor/imu` | IMU 센서 읽기 | Bearer |
| POST | `/api/admin/robot/motor/move` | 모터 이동 | Bearer |
| POST | `/api/admin/robot/motor/stop` | 모터 정지 | Bearer |
| GET | `/api/admin/robot/camera/snapshot` | 최신 카메라 이미지 | token query |
| GET | `/api/admin/robot/camera/status` | 카메라 상태 | Bearer |
| GET | `/api/admin/robot/camera/analysis` | 카메라 분석값 | Bearer |
| GET | `/api/admin/dev/tables` | DB 테이블 스키마 | Bearer |
| GET | `/api/admin/dev/erd` | ERD 데이터 | Bearer |

## SQLite 메모

- `lcd_images` 테이블에 LCD 이미지 업로드 기록을 저장합니다.
- 기존 업로드 폴더의 이미지는 목록 조회 시 자동 동기화됩니다.
- `management.db`와 `robot.db`는 첫 실행 때 자동 생성됩니다.

## 환경변수

```bash
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ADMIN_DATABASE_URL=sqlite+aiosqlite:///management.db
ROBOT_DATABASE_URL=sqlite+aiosqlite:///robot.db
```

## 서비스 등록 예시

```ini
[Unit]
Description=Labi Bot Admin API
After=network.target

[Service]
User=pinky
WorkingDirectory=/home/pinky/bot_ai_server/backend
ExecStart=/home/pinky/bot_ai_server/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 9001
Restart=always

[Install]
WantedBy=multi-user.target
```
