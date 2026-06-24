#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
PID_FILE="$SCRIPT_DIR/.pid"
LOG_FILE="$SCRIPT_DIR/robot_agent.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "이미 실행 중입니다. (PID: $(cat "$PID_FILE"))"
    exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
    echo "가상환경 생성 중..."
    if ! python3 -m venv "$VENV_DIR" --system-site-packages 2>/dev/null; then
        echo "python3-venv 설치 중..."
        sudo apt install -y python3.12-venv
        python3 -m venv "$VENV_DIR" --system-site-packages
    fi
fi

source "$VENV_DIR/bin/activate"

echo "의존성 설치 중..."
pip install -q -r "$SCRIPT_DIR/requirements-driving.txt"

echo "robot_agent 시작..."
nohup python3 "$SCRIPT_DIR/main.py" > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "실행됨 (PID: $!, 로그: $LOG_FILE)"
