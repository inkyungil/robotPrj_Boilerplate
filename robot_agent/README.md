# robot_agent

로봇 PC 온보드 에이전트. 5대의 로봇 PC가 **동일한 코드**로 `:9001` 포트에 FastAPI 서버를 띄우고,
`.env` 의 `ROBOT_TYPE` 한 줄만 다르게 두어 arm / driving 동작을 전환한다.

## 시스템 구성 및 아키텍처

중앙 관제 서버(Gateway)에서 각 로봇 온보드 에이전트(FastAPI)로 요청을 라우팅하고, 각 에이전트가 내부적으로 시리얼 통신 혹은 ROS2(rclpy)를 통해 물리 로봇 장비를 제어하는 아키텍처입니다.

### 아키텍처 다이어그램 (Mermaid)

```mermaid
graph TD
    %% 스타일 정의
    classDef user fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef central fill:#efebe9,stroke:#5d4037,stroke-width:2px;
    classDef agent_arm fill:#ede7f6,stroke:#7b1fa2,stroke-width:2px;
    classDef agent_drive fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef hw_arm fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef hw_drive fill:#f1f8e9,stroke:#558b2f,stroke-width:2px;

    %% 사용자 영역
    User([사용자 / 웹 브라우저]):::user

    %% 중앙 관제 서버 영역 (Gateway)
    subgraph CentralServer["중앙 관제 서버 (Gateway PC - 192.168.0.9)"]
        Frontend["어드민 콘솔 웹 (Port :9002)<br/>React/Vite Dashboard"]:::central
        Backend["관제 API 서버 (Port :9000)<br/>FastAPI / SQLite / YOLO 모델"]:::central
    end

    %% 네트워크 연결
    User -->|HTTP / WebSocket 접속| Frontend
    Frontend -->|API 요청 및 상태 조회| Backend

    %% 로봇팔 에이전트 영역 (ROBOT_TYPE=arm)
    subgraph RobotArmAgents["로봇팔 에이전트 그룹 (ROBOT_TYPE=arm)"]
        subgraph JetCobot1["[로봇팔 1] JetCobot-1 (192.168.0.70)"]
            AgentArm1["FastAPI Agent (Port :9001)"]:::agent_arm
            DriverArm1["ArmDriver (pymycobot)"]:::agent_arm
            MCU_Arm1["물리 로봇팔 하드웨어<br/>(MyCobot 280 Pi / Arduino)"]:::hw_arm
        end

        subgraph JetCobot2["[로봇팔 2] JetCobot-2 (192.168.0.72)"]
            AgentArm2["FastAPI Agent (Port :9001)"]:::agent_arm
            DriverArm2["ArmDriver (pymycobot)"]:::agent_arm
            MCU_Arm2["물리 로봇팔 하드웨어<br/>(MyCobot 280 Pi / Arduino)"]:::hw_arm
        end
    end

    %% 주행로봇 에이전트 영역 (ROBOT_TYPE=driving)
    subgraph DrivingAgents["주행 로봇 에이전트 그룹 (ROBOT_TYPE=driving)"]
        subgraph Pinky1["[주행봇 1] Pinky-1 (192.168.0.71)"]
            AgentDrive1["FastAPI Agent (Port :9001)"]:::agent_drive
            NodeDrive1["rclpy ROS2 Node"]:::agent_drive
            STM_Drive1["STM32 모터/센서 컨트롤러<br/>(serial / motor_ctrl.py)"]:::hw_drive
        end

        subgraph Pinky2["[주행봇 2] Pinky-2 (192.168.0.73)"]
            AgentDrive2["FastAPI Agent (Port :9001)"]:::agent_drive
            NodeDrive2["rclpy ROS2 Node"]:::agent_drive
            STM_Drive2["STM32 모터/센서 컨트롤러<br/>(serial / motor_ctrl.py)"]:::hw_drive
        end

        subgraph Pinky3["[주행봇 3] Pinky-3 (192.168.0.74)"]
            AgentDrive3["FastAPI Agent (Port :9001)"]:::agent_drive
            NodeDrive3["rclpy ROS2 Node"]:::agent_drive
            STM_Drive3["STM32 모터/센서 컨트롤러<br/>(serial / motor_ctrl.py)"]:::hw_drive
        end
    end

    %% Gateway에서 각 로봇으로 요청 중계 (Forwarding)
    Backend -->|API/WS Command| AgentArm1
    Backend -->|API/WS Command| AgentArm2
    Backend -->|API/WS Command| AgentDrive1
    Backend -->|API/WS Command| AgentDrive2
    Backend -->|API/WS Command| AgentDrive3

    %% 로봇팔 제어 흐름
    AgentArm1 -->|호출| DriverArm1
    DriverArm1 -->|USB 시리얼 제어 /dev/ttyUSB0| MCU_Arm1

    AgentArm2 -->|호출| DriverArm2
    DriverArm2 -->|USB 시리얼 제어 /dev/ttyUSB0| MCU_Arm2

    %% 주행로봇 제어 흐름
    AgentDrive1 -->|Topic 발행/구독| NodeDrive1
    NodeDrive1 -->|ROS2 cmd_vel / odom| STM_Drive1
    AgentDrive1 -.->|ROS2 미구동 시 직접 통신 폴백| STM_Drive1

    AgentDrive2 -->|Topic 발행/구독| NodeDrive2
    NodeDrive2 -->|ROS2 cmd_vel / odom| STM_Drive2
    AgentDrive2 -.->|ROS2 미구동 시 직접 통신 폴백| STM_Drive2

    AgentDrive3 -->|Topic 발행/구독| NodeDrive3
    NodeDrive3 -->|ROS2 cmd_vel / odom| STM_Drive3
    AgentDrive3 -.->|ROS2 미구동 시 직접 통신 폴백| STM_Drive3
```

### 제어 흐름 및 역할 설명

1. **중앙 관제 서버 (Gateway 역할 - `192.168.0.9`)**:
   * 프론트엔드 웹 화면(`:9002`) 혹은 백엔드 관제 API 서버(`:9000`)가 전체 로봇들의 API 진입점인 **Gateway** 역할을 합니다.
   * 사용자의 명령을 수신하면 각 로봇의 온보드 PC IP 주소와 포트(`:9001`)로 요청을 전달(Forwarding)합니다.
2. **로봇 온보드 에이전트 (`robot_agent` - FastAPI)**:
   * 로봇 PC 안에서 실행되는 온보드 웹 서비스로, 5대의 로봇 모두 **완전히 동일한 코드**로 실행되며 오직 `.env` 설정에 따라 로봇팔(`arm`) 또는 주행로봇(`driving`)으로 기동합니다.
3. **로봇팔 제어 (JetCobot-1, JetCobot-2)**:
   * FastAPI 요청 수신 시, `ArmDriver`가 파이썬 라이브러리(`pymycobot`)를 사용하여 USB-시리얼 케이블을 통해 물리 모터 보드에 직접 명령을 전송합니다 (ROS2 미경유).
4. **주행 로봇 제어 (Pinky-1, Pinky-2, Pinky-3)**:
   * FastAPI 요청 수신 시, 백그라운드에서 동작 중인 ROS2 노드(`rclpy`)에 명령을 내려 속도 토픽(`cmd_vel`)을 발생시키고 바퀴를 제어합니다.
   * 만약 ROS2가 구동 중이 아닌 경우, 에이전트가 직접 모터 스크립트([motor_ctrl.py](file:///home/robotPrj_Boilerplate/robot_agent/app/hardware/motor_ctrl.py))를 실행해 시리얼 통신으로 제어하는 폴백(Fallback) 방식을 내장하고 있습니다.


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
    │   └── ros_bridge.py       #   odom/map/scan 등 ROS2 토픽 송수신 및 캐싱 브릿지
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
- 의존성 설치 후 백그라운드로 서버 실행
- 로그: `robot_agent.log`
- 실행 확인: http://0.0.0.0:9001/health

### 3. 서버 중지

```bash
bash stop.sh
```

## 엔드포인트

에이전트는 실행 시 설정된 `ROBOT_TYPE`에 따라 활성화되는 엔드포인트만 노출합니다. 또한, 중앙 관제 서버(FMS) 및 대시보드 호환을 위해 고유 에이전트 경로와 레거시 호환 경로를 모두 라우팅합니다.

### 1. 공통 API (Common - 모든 모드 공통 활성화)
기본적으로 `/api/...` 프리픽스 하에 제공됩니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 에이전트 헬스 체크 |
| GET | `/api/status` | 현재 에이전트 드라이버 상태 (드라이버가 형태 결정) |
| POST | `/api/stop` | 즉시 정지 |
| POST | `/api/home` | 홈 포지션 복귀 |
| GET | `/api/admin/robot/lcd/fonts` | 사용 가능한 LCD 폰트 목록 조회 |
| GET | `/api/arm/pinky-detect/status` | 검출 모델 상태 조회 (중앙 서버 처리 관련 안내) |

### 2. 카메라 제어 API (Camera - 공통)
카메라 제어는 모든 에이전트 PC에서 공통적으로 지원하며, `/api/admin/robot/camera/...` 프리픽스로 매핑됩니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/robot/camera/stream` | 카메라 MJPEG 실시간 스트림 |
| GET | `/api/admin/robot/camera/snapshot` | 카메라 단일 스냅샷 이미지 조회 (JPEG) |
| POST | `/api/admin/robot/camera/start` | 카메라 디바이스 기동 |
| POST | `/api/admin/robot/camera/stop` | 카메라 디바이스 정지 |
| GET | `/api/admin/robot/camera/status` | 카메라 동작 상태 및 성능 디버그 정보 조회 |

### 3. 로봇팔 전용 API (Arm PC - `ROBOT_TYPE=arm`)
모든 API는 `/arm/...` 경로와 `/api/arm/...` 경로(레거시/관제 서버)를 병행 지원합니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/arm/state` | 현재 관절 각도, 그리퍼 정보, 연결 여부 조회 |
| POST | `/arm/angles` | 전체 관절 동시 회전 각도 제어 |
| POST | `/arm/gripper` | 그리퍼 제어 (0 ~ 100 값 지정) |
| POST | `/arm/stop` | 로봇팔 긴급 정지 |
| POST | `/arm/home` | 홈 포지션 복귀 및 그리퍼 완전 오픈 |
| POST | `/arm/jog-stop` | 조그 및 수동 조작 즉시 정지 |

### 4. 주행 로봇 전용 API (Driving PC - `ROBOT_TYPE=driving`)
모든 API는 `/driving/...` 경로와 `/api/admin/robot/...` 경로(레거시/관제 서버)를 병행 지원합니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/driving/move` | 직선 주행 제어 |
| POST | `/driving/rotate` | 제자리 회전 제어 |
| WS | `/driving/ws/drive` | 실시간 조이스틱 주행 WebSocket 제어 |
| GET | `/driving/status` | ROS 도메인 상태 및 실행 프로세스(SLAM/Nav2 등) 목록 조회 |
| POST | `/driving/process/{name}/start`| SLAM/Nav2/Teleop 프로세스 구동 (name: teleop/obstacle_avoid/slam/nav2) |
| POST | `/driving/process/{name}/stop` | 프로세스 중단 |
| GET | `/driving/process/{name}/log` | 프로세스 구동 로그 조회 |
| GET | `/driving/drive/target` | 현재 제어 타겟(real 모드) 조회 |
| POST | `/driving/drive/target` | 제어 타겟 설정 |
| POST | `/driving/lcd/emotion` | LCD 전면 패널 표정 표현 |
| POST | `/driving/lcd/stop` | LCD 표정 표현 중지 |
| POST | `/driving/lcd/image` | LCD 이미지 파일 업로드 및 출력 |
| POST | `/driving/lcd/image/select`| 기 업로드된 LCD 이미지 선택 출력 |
| GET | `/driving/lcd/images` | LCD 이미지 목록 조회 |
| DELETE| `/driving/lcd/images/{name}` | LCD 이미지 파일 삭제 |
| POST | `/driving/lcd/text` | LCD에 커스텀 텍스트 출력 (폰트, 스크롤 등 지정) |
| POST | `/driving/lcd/font` | LCD 한글/영문 TTF, OTF 폰트 파일 업로드 |
| GET | `/driving/lcd/fonts` | 폰트 목록 조회 |
| DELETE| `/driving/lcd/fonts/{name}` | 폰트 파일 삭제 |
| POST | `/driving/led/fill` | LED 조명 단색으로 채우기 |
| POST | `/driving/led/pixel` | LED 특정 픽셀 단위 컬러 지정 |
| POST | `/driving/led/clear` | LED 조명 소등 |
| POST | `/driving/led/brightness`| LED 조명 밝기 조절 |
| POST | `/driving/buzzer` | 알람음 부저 재생 (Bell, Beep 등) |
| GET | `/driving/buzzer/status` | 부저 멜로디 연동 여부 및 재생 상태 조회 |
| POST | `/driving/buzzer/melody/play` | 멜로디 곡 재생 (엘리제를 위하여, 학교종 등) |
| POST | `/driving/buzzer/melody/stop` | 멜로디 재생 강제 중단 |
| GET | `/driving/sensor/ultrasonic`| 초음파 거리 센서 측정 결과 조회 |
| GET | `/driving/sensor/battery` | 배터리 전압 및 잔여 퍼센트 조회 |
| GET | `/driving/sensor/ir` | 적외선 장애물 센서 반환값 조회 |
| GET | `/driving/sensor/imu` | IMU 가속도, 자이로, 오일러 각 측정값 조회 |
| POST | `/driving/motor/move` | 좌우 모터 전력 속도율 직접 지정 주행 |
| POST | `/driving/motor/stop` | 모터 직접 정지 |

---

## 5. 분석 보고서
* [핑키프로 YOLOv8 인식 신뢰도 임계값 분석 보고서](file:///home/robotPrj_Boilerplate/robot_agent/pinky_detect_threshold_report.md)

