# Pinky 로봇 부팅 자동 시작 (systemd)

로봇 전원만 켜면 **라이다·오도메트리·TF(하드웨어) → nav2 + 웹서버**가
순서대로 자동 실행되도록 systemd 서비스로 구성한 내용이다.

기존에 손으로 터미널 2개를 열어 실행하던 아래 작업을 자동화한 것이다.

```bash
# 터미널 1 — 하드웨어
source ~/pinky_pro/install/setup.bash
ros2 launch pinky_bringup bringup_robot.launch.xml

# 터미널 2 — nav2 + 웹서버
ros2 launch pinky_navigation bringup_launch.xml \
    map:=/home/robotPrj/rosPkg/mymap123.yaml
```

## 구성

| 파일 | 역할 |
|------|------|
| `start_hardware.sh` | ROS 환경 source 후 `pinky_bringup` 실행 (하드웨어) |
| `start_nav.sh` | ROS 환경 source 후 `pinky_navigation` 실행 (nav2 + 웹서버, 맵 지정) |
| `pinky-hardware.service` | 하드웨어 서비스 (부팅 시 1순위) |
| `pinky-nav.service` | nav2 서비스. `pinky-hardware` 이후 5초 뒤 시작 |

### 핵심 포인트
- 부팅 시에는 `~/.bashrc`가 자동 실행되지 않으므로 **스크립트 안에서 `setup.bash`를 직접 source** 한다.
- `pinky-nav.service`는 `After=` / `Requires=`로 하드웨어 서비스에 의존하고,
  `ExecStartPre=/bin/sleep 5`로 라이다·TF가 뜰 시간을 확보한 뒤 시작한다.
- `Restart=on-failure`로 비정상 종료 시 자동 재시작된다.

- ROS 배포판: **jazzy**
- 맵 경로: `/home/robotPrj/rosPkg/mymap123.yaml`
- 워크스페이스: `/home/pinky/pinky_pro/install/setup.bash`

## 설치 방법

```bash
# 1) 실행 스크립트를 홈에 배치하고 실행 권한 부여
cp start_hardware.sh start_nav.sh /home/pinky/
chmod +x /home/pinky/start_hardware.sh /home/pinky/start_nav.sh

# 2) 서비스 파일 설치
sudo cp pinky-hardware.service pinky-nav.service /etc/systemd/system/
sudo systemctl daemon-reload

# 3) 부팅 자동 시작 등록
sudo systemctl enable pinky-hardware.service pinky-nav.service

# 4) 지금 바로 시작 (테스트)
sudo systemctl start pinky-hardware.service
sudo systemctl start pinky-nav.service
```

## 상태 확인 / 로그

```bash
systemctl status pinky-hardware.service
systemctl status pinky-nav.service
journalctl -u pinky-nav.service -f      # 실시간 로그
```

## 자주 막히는 부분
- **source 경로**: `/home/pinky/pinky_pro/install/setup.bash`가 실제로 있는지 확인.
  빌드 위치가 다르면 두 스크립트의 경로를 수정한다.
- **sleep 시간**: 라이다·TF가 뜨는 데 5초보다 오래 걸리면
  `pinky-nav.service`의 `sleep 5`를 `sleep 10` 등으로 늘린다.
- **맵 경로**: nav 서비스가 못 뜨면 `start_nav.sh`의 `map:=` 경로를 확인한다.

## 중지 / 해제

```bash
sudo systemctl stop pinky-nav.service pinky-hardware.service       # 지금 중지
sudo systemctl disable pinky-nav.service pinky-hardware.service    # 자동 시작 해제
```
