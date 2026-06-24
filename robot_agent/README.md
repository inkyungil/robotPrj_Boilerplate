# robot_agent

로봇 PC 온보드 에이전트. 5대의 로봇 PC가 **동일한 코드**로 `:9001` 포트에 FastAPI 서버를 띄우고,
`.env` 의 `ROBOT_TYPE` 한 줄만 다르게 두어 arm / driving 동작을 전환한다.

## 시스템 구성

```
중앙 PC (192.168.0.9)
  central_server (FastAPI) ── HTTP/WS ──┬─→ 192.168.0.70:9001  JetCobot-1  (ROBOT_TYPE=arm)
                                        ├─→ 192.168.0.72:9001  JetCobot-2  (ROBOT_TYPE=arm)
                                        ├─→ 192.168.0.71:9001  Pinky-1     (ROBOT_TYPE=driving)
                                        ├─→ 192.168.0.73:9001  Pinky-2     (ROBOT_TYPE=driving)
                                        └─→ 192.168.0.74:9001  Pinky-3     (ROBOT_TYPE=driving)

각 로봇 PC
  robot_agent (FastAPI) ── 내부 ──→ rclpy Node ── ROS2 ──→ 로봇 하드웨어
```

## 폴더 구조

```
robot_agent/
├── .env.example                # ROBOT_TYPE=arm|driving, PORT=9001 (PC마다 한 줄만 다름)
├── .env                        # 실제 환경 설정 (PC마다 ROBOT_TYPE 다르게 설정)
├── start.sh                    # 가상환경 생성·의존성 설치·서버 시작 스크립트
├── stop.sh                     # 서버 중지 스크립트
├── requirements.txt            # 공통 의존성 (fastapi, uvicorn, pydantic, python-multipart)
├── requirements-arm.txt        # 공통 + pymycobot      (arm PC)
├── requirements-driving.txt    # 공통 + ROS2(rclpy)    (driving PC)
├── main.py                     # 공통 진입점: ROBOT_TYPE 읽어 드라이버·라우터 선택 + rclpy 기동
├── config/                     # ── 주행 로봇(Pinky) 파라미터 설정 ──
│   ├── nav2_params.yaml        #   Navigation2 파라미터 파일
│   └── slam_params.yaml        #   SLAM Toolbox 파라미터 파일
├── scripts/                    # ── 주행 로봇(Pinky) 실행 스크립트 ──
│   ├── run_obstacle_avoid.sh   #   장애물 회전 회피 노드 시작 스크립트
│   └── run_turtlebot3_teleop.sh#   수동 키보드 제어 노드 시작 스크립트
└── app/
    ├── config.py               # ROBOT_TYPE, HOST, PORT 등 .env 로드
    ├── core/                    # ── 공통 골격 및 ROS2 통신 모듈 ──
    │   ├── server.py           #   create_app() + lifespan(드라이버/rclpy/ros_bridge 기동)
    │   ├── bridge.py           #   API ↔ 드라이버/ROS 공유상태 (스레드 안전, 활성 드라이버 보관)
    │   ├── ros_node.py         #   rclpy 노드 라이프사이클 관리 래퍼
    │   ├── ros_bridge.py       #   odom/map/scan 등 ROS2 토픽 송수신 및 캐싱 브릿지
    │   └── explorer.py         #   자율 탐색(Frontier Exploration) 주행 제어 엔진
    ├── drivers/                # ── ★ 여기만 타입별로 다름 ──
    │   ├── __init__.py         #   create_driver(): ROBOT_TYPE → 드라이버 (lazy import)
    │   ├── base.py             #   공통 인터페이스(ABC): get_status() / stop() / home()
    │   ├── arm_driver.py       #   pymycobot 관절·그리퍼 제어 (시리얼 물리 연결)
    │   └── driving_driver.py   #   ROS2 내비게이션 및 모터 제어 (ROS2/motor_ctrl 자동 폴백)
    ├── hardware/               # ── 주행 로봇(Pinky) 실장비 제어 데몬 ──
    │   ├── motor_ctrl.py       #   주행 모터 제어 daemon 래퍼
    │   ├── sensor_ctrl.py      #   초음파/IR/IMU/배터리 센서 combo daemon 래퍼
    │   ├── lcd_ctrl.py         #   LCD 얼굴 표정 및 텍스트 표시 daemon 래퍼
    │   ├── led_ctrl.py         #   LED 스트립 조명 fill/pixel 제어 래퍼
    │   └── buzzer_ctrl.py      #   부저 멜로디 및 알림음 재생 래퍼
    ├── routers/
    │   ├── common.py           #   /health · /status · /stop · /home (공통)
    │   ├── camera.py           #   카메라 송출 (공통)
    │   ├── arm.py              #   로봇팔 제어 (/state, /angles, /gripper, /stop, /home 등)
    │   └── driving.py          #   주행로봇 제어 (/move, /rotate, /ws/drive, /explore/start 등)
    ├── schemas/
    │   ├── arm.py              #   JogRequest · GripperRequest · JointState
    │   └── driving.py          #   MoveRequest · RotateRequest · DriveState
    └── models/                 #   (예약) 도메인/영속 모델
```

## 설계 원칙

- **타입 무관 골격(core) + 타입별 드라이버(drivers) 분리.** 라우터·브리지는 `BaseDriver`
  인터페이스만 알고, 하드웨어 제어 차이는 드라이버가 캡슐화한다.
- **하드웨어 의존성은 lazy import.** `pymycobot`(arm) / `rclpy`(driving) 는 선택된 타입에서만
  import 되므로, 한쪽 라이브러리가 없는 PC에서도 부팅이 가능하다.
- **활성 타입의 라우터만 노출.** `create_app()` 이 `ROBOT_TYPE` 에 따라 arm 또는 driving
  라우터만 장착한다.
- **스레드 경계는 bridge 로.** FastAPI 핸들러(요청 스레드)와 rclpy executor(spin 스레드)는
  `bridge` 의 락을 통해서만 드라이버에 접근한다.

## 실행

### 1. .env 설정

PC 타입에 맞게 `.env` 파일의 `ROBOT_TYPE`을 설정한다.

```bash
# arm PC (JetCobot)
ROBOT_TYPE=arm

# driving PC (Pinky)
ROBOT_TYPE=driving
```

### 2. 서버 시작

```bash
bash start.sh
```

- 가상환경(`.venv`)이 없으면 자동 생성
- `python3-venv` 패키지가 없으면 자동 설치 (sudo 필요)
- 의존성 자동 설치 후 백그라운드로 서버 실행
- 로그: `robot_agent.log`
- 실행 확인: http://0.0.0.0:9001/health

### 3. 서버 중지

```bash
bash stop.sh
```

### 4. 수동 실행 (스크립트 없이)

```bash
# arm PC
pip install -r requirements-arm.txt
python main.py

# driving PC (ROS2 환경 소스 필요)
source /opt/ros/jazzy/setup.bash
pip install -r requirements-driving.txt
python main.py
```

## 엔드포인트

| 메서드 | 경로 | 타입 | 설명 |
|--------|------|------|------|
| GET  | `/health`         | 공통    | 헬스 체크 |
| GET  | `/status`         | 공통    | 현재 상태 (드라이버가 형태 결정) |
| POST | `/stop`           | 공통    | 즉시 정지 |
| POST | `/home`           | 공통    | 홈 포지션 이동/복귀 |
| GET  | `/camera/info`    | 공통    | 카메라 메타데이터 |
| POST | `/arm/jog`        | arm     | 단일 관절 조그 |
| POST | `/arm/gripper`    | arm     | 그리퍼 개폐 |
| POST | `/driving/move`   | driving | 직선 이동 |
| POST | `/driving/rotate` | driving | 제자리 회전 |
