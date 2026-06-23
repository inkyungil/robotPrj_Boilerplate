// 현재 제어 대상 로봇을 전역으로 관리.
//  - 중앙 API(로그인/관리자/로봇 IP 레지스트리)는 VITE_ADMIN_API_URL(중앙 서버)로 호출.
//  - 로봇 제어 API는 "선택된 로봇"의 ip:port 로 호출.
// 선택값은 localStorage 에 저장하고, 변경 시 구독자에게 알린다.

import { useSyncExternalStore } from "react";

const ID_KEY = "labi.activeRobotId";
const BASE_KEY = "labi.activeRobotBase";
const NAME_KEY = "labi.activeRobotName";
const TYPE_KEY = "labi.activeRobotType";
const AI_SERVER_KEY = "labi.activeRobotAiServer";

const CENTRAL_BASE = (import.meta.env.VITE_ADMIN_API_URL ?? "").replace(/\/$/, "");

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export type ActiveRobotType = "arm" | "pinky" | "other" | "server";

export interface ActiveRobot {
  id: number;
  name: string;
  type: ActiveRobotType;
  base: string;
  ai_server_url?: string | null;
}

export function getCentralBase(): string {
  return CENTRAL_BASE;
}

export function getActiveRobotId(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(ID_KEY);
  return raw ? Number(raw) : null;
}

export function getRobotBase(): string {
  if (typeof localStorage === "undefined") return CENTRAL_BASE;
  return localStorage.getItem(BASE_KEY) || CENTRAL_BASE;
}

export function getActiveRobotAiServer(): string {
  if (typeof localStorage === "undefined") return CENTRAL_BASE;
  return localStorage.getItem(AI_SERVER_KEY) || CENTRAL_BASE;
}

export function getActiveRobotName(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

export function getActiveRobotType(): ActiveRobotType | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(TYPE_KEY);
  return raw === "arm" || raw === "pinky" || raw === "other" ? raw : null;
}

export function setActiveRobot(robot: ActiveRobot | null): void {
  if (typeof localStorage === "undefined") return;
  if (robot == null) {
    localStorage.removeItem(ID_KEY);
    localStorage.removeItem(BASE_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(TYPE_KEY);
    localStorage.removeItem(AI_SERVER_KEY);
  } else {
    localStorage.setItem(ID_KEY, String(robot.id));
    localStorage.setItem(BASE_KEY, robot.base);
    localStorage.setItem(NAME_KEY, robot.name);
    localStorage.setItem(TYPE_KEY, robot.type);
    if (robot.ai_server_url) {
      localStorage.setItem(AI_SERVER_KEY, robot.ai_server_url);
    } else {
      localStorage.removeItem(AI_SERVER_KEY);
    }
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useActiveRobotId(): number | null {
  return useSyncExternalStore(subscribe, getActiveRobotId, () => null);
}

export function useActiveRobotName(): string | null {
  return useSyncExternalStore(subscribe, getActiveRobotName, () => null);
}

export function useActiveRobotType(): ActiveRobotType | null {
  return useSyncExternalStore(subscribe, getActiveRobotType, () => null);
}

export function useActiveRobotBase(): string {
  return useSyncExternalStore(subscribe, getRobotBase, () => CENTRAL_BASE);
}

export function buildRobotHttpUrl(base: string, path: string): string {
  const isAiPath = path.startsWith("/api/arm/color-pick") ||
                   path.startsWith("/api/arm/face-track/") ||
                   path.startsWith("/api/arm/gesture/") ||
                   path.startsWith("/api/arm/pinky-detect") ||
                   path.startsWith("/api/arm/ocr/") ||
                   path.startsWith("/api/arm/sequences") ||
                   path.startsWith("/api/arm/playback") ||
                   path.startsWith("/api/arm/camera-view");

  if (isAiPath) {
    const aiServer = getActiveRobotAiServer();
    const cleanCentral = aiServer.replace(/\/$/, "");
    let robotIp = "";
    try {
      const robotUrl = new URL(base);
      robotIp = robotUrl.hostname;
    } catch {
      robotIp = base.replace(/https?:\/\//, "").split(":")[0];
    }
    const separator = path.includes("?") ? "&" : "?";
    return cleanCentral + path + separator + "robot_ip=" + encodeURIComponent(robotIp);
  }

  const cleanBase = base.replace(/\/$/, "");
  return cleanBase ? cleanBase + path : path;
}

export function buildRobotWsUrl(base: string, path: string): string {
  const isAiPath = path.startsWith("/api/arm/ws/arm") ||
                   path.startsWith("/api/arm/pinky-detect/ws");

  if (isAiPath) {
    const aiServer = getActiveRobotAiServer();
    const cleanCentral = aiServer.replace(/\/$/, "");
    const url = new URL(cleanCentral);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

    let robotIp = "";
    try {
      const robotUrl = new URL(base);
      robotIp = robotUrl.hostname;
    } catch {
      robotIp = base.replace(/https?:\/\//, "").split(":")[0];
    }
    const separator = path.includes("?") ? "&" : "?";
    return url.protocol + "//" + url.host + path + separator + "robot_ip=" + encodeURIComponent(robotIp);
  }

  const cleanBase = base.replace(/\/$/, "");
  if (!cleanBase) return path;
  const url = new URL(cleanBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.protocol + "//" + url.host + path;
}
