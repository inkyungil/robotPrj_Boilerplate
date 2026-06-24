import { getCentralBase, getRobotBase } from "./active-robot";

const API_BASE = getCentralBase();

// 로봇 제어 호출은 선택된 로봇 IP 로, 그 외(인증/관리자/로봇 레지스트리)는 중앙 서버로 보낸다.
function baseFor(path: string): string {
  const isRobotControl = path.startsWith("/api/admin/robot/") || path.startsWith("/api/arm/");
  return isRobotControl ? getRobotBase() : API_BASE;
}

const TOKEN_KEY = "labi.adminToken";

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

export type AdminRole = "superadmin" | "admin";

export interface Admin {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

export type RobotType = "arm" | "pinky" | "other" | "server";

export interface Robot {
  id: number;
  name: string;
  robot_type: RobotType;
  ip_address: string;
  port: number;
  domain_id: number | null;
  ai_server_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateRobotInput {
  name: string;
  robot_type: RobotType;
  ip_address: string;
  port: number;
  domain_id?: number | null;
  ai_server_url?: string | null;
  description?: string | null;
  is_active: boolean;
}

export interface UpdateRobotInput {
  name?: string;
  robot_type?: RobotType;
  ip_address?: string;
  port?: number;
  domain_id?: number | null;
  ai_server_url?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface DashboardStats {
  total_admins: number;
  active_admins: number;
  total_conversations: number;
  total_messages: number;
  selected_model: string | null;
  conversations_per_day: DayCount[];
  recent_admins: Admin[];
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  admin: Admin;
}

export interface SchemaColumn {
  name: string;
  type: string;
  key: "" | "PK" | "FK" | "UQ";
  nullable: boolean;
  defaultValue: string | null;
  description: string;
}

export interface SchemaTable {
  tableName: string;
  description: string;
  columns: SchemaColumn[];
}

export interface ErdRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface ErdResponse {
  tables: SchemaTable[];
  relations: ErdRelation[];
}

export interface RobotResult {
  success: boolean;
  output: string;
  error: string;
}

export interface MotorMoveInput {
  left: number;
  right: number;
  duration: number;
}

export interface LcdImageItem {
  id: number;
  filename: string;
  original_name: string;
  content_type: string | null;
  size_bytes: number;
  created_at: string | null;
}

export interface CameraAnalysis {
  timestamp: number;
  width: number;
  height: number;
  brightness: number;
  motion_score: number;
  edge_density: number;
  avg_rgb: [number, number, number];
}

export interface LcdTextConfig {
  text: string;
  font_name: string;
  font_size: number;
  color: string;
  bg_color: string;
  align: string;
  scroll?: boolean;
  scroll_speed?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(baseFor(path) + path, { ...options, headers });

  if (res.status === 401 && auth) {
    clearToken();
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.endsWith("/admin/login")
    ) {
      window.location.href = "/admin/login";
    }
    throw new ApiError(401, "인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (!res.ok) {
    let detail = `요청에 실패했습니다 (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function uploadFile<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(baseFor(path) + path, { method: "POST", headers, body: form });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/admin/login";
    throw new ApiError(401, "인증이 만료되었습니다.");
  }
  if (!res.ok) {
    let detail = `업로드 실패 (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* noop */ }
    throw new ApiError(res.status, detail);
  }
  return res.json() as T;
}

export interface CreateAdminInput {
  username: string;
  password: string;
  email?: string | null;
  full_name?: string | null;
  role: AdminRole;
  is_active: boolean;
}

export interface UpdateAdminInput {
  password?: string;
  email?: string | null;
  full_name?: string | null;
  role?: AdminRole;
  is_active?: boolean;
}

export const adminApi = {
  login: (username: string, password: string) =>
    request<LoginResult>(
      "/api/admin/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) },
      false,
    ),
  me: () => request<Admin>("/api/admin/auth/me"),
  getStats: () => request<DashboardStats>("/api/admin/dashboard/stats"),
  listUsers: (params?: { q?: string; skip?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return request<{ items: Admin[]; total: number }>(
      `/api/admin/users${s ? `?${s}` : ""}`,
    );
  },
  createUser: (data: CreateAdminInput) =>
    request<Admin>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUser: (id: number, data: UpdateAdminInput) =>
    request<Admin>(`/api/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteUser: (id: number) =>
    request<void>(`/api/admin/users/${id}`, { method: "DELETE" }),

  // ── 로봇 레지스트리 (IP 관리) ─────────────────────────────────────────────────
  listRobots: (params?: { q?: string; robot_type?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.robot_type) qs.set("robot_type", params.robot_type);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return request<{ items: Robot[]; total: number }>(
      `/api/admin/robots${s ? `?${s}` : ""}`,
    );
  },
  createRobot: (data: CreateRobotInput) =>
    request<Robot>("/api/admin/robots", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRobot: (id: number, data: UpdateRobotInput) =>
    request<Robot>(`/api/admin/robots/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRobot: (id: number) =>
    request<void>(`/api/admin/robots/${id}`, { method: "DELETE" }),

  getTables: () => request<SchemaTable[]>("/api/admin/dev/tables"),
  getErd: () => request<ErdResponse>("/api/admin/dev/erd"),

  // ── LCD ──────────────────────────────────────────────────────────────────────
  setEmotion: (emotion: string) =>
    request<RobotResult>("/api/admin/robot/lcd/emotion", {
      method: "POST",
      body: JSON.stringify({ emotion }),
    }),
  lcdStop: () =>
    request<RobotResult>("/api/admin/robot/lcd/stop", { method: "POST" }),

  // 이미지
  lcdUploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadFile<RobotResult & { image?: LcdImageItem }>("/api/admin/robot/lcd/image", form);
  },
  lcdSelectImage: (filename: string) =>
    request<RobotResult>("/api/admin/robot/lcd/image/select", {
      method: "POST",
      body: JSON.stringify({ filename }),
    }),
  listImages: () => request<{ images: LcdImageItem[] }>("/api/admin/robot/lcd/images"),
  deleteImage: (name: string) =>
    request<{ success: boolean }>(`/api/admin/robot/lcd/images/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  // 텍스트
  lcdText: (cfg: LcdTextConfig) =>
    request<RobotResult>("/api/admin/robot/lcd/text", {
      method: "POST",
      body: JSON.stringify(cfg),
    }),

  // 폰트
  lcdUploadFont: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadFile<{ success: boolean; filename: string }>("/api/admin/robot/lcd/font", form);
  },
  listFonts: () => request<{ fonts: string[] }>("/api/admin/robot/lcd/fonts"),
  deleteFont: (name: string) =>
    request<{ success: boolean }>(`/api/admin/robot/lcd/fonts/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  // ── LED ──────────────────────────────────────────────────────────────────────
  ledFill: (r: number, g: number, b: number) =>
    request<RobotResult>("/api/admin/robot/led/fill", {
      method: "POST",
      body: JSON.stringify({ r, g, b }),
    }),
  ledPixel: (pixels: number[], r: number, g: number, b: number) =>
    request<RobotResult>("/api/admin/robot/led/pixel", {
      method: "POST",
      body: JSON.stringify({ pixels, r, g, b }),
    }),
  ledClear: () =>
    request<RobotResult>("/api/admin/robot/led/clear", { method: "POST" }),
  ledBrightness: (brightness: number) =>
    request<RobotResult>("/api/admin/robot/led/brightness", {
      method: "POST",
      body: JSON.stringify({ brightness }),
    }),

  // ── 부저 ─────────────────────────────────────────────────────────────────────
  playBuzzer: (preset: string) =>
    request<RobotResult>("/api/admin/robot/buzzer", {
      method: "POST",
      body: JSON.stringify({ preset }),
    }),
  playBuzzerMelody: (melody: "fur_elise" | "school_bell") =>
    request<RobotResult>("/api/admin/robot/buzzer/melody/play", {
      method: "POST",
      body: JSON.stringify({ melody }),
    }),
  stopBuzzerMelody: () =>
    request<RobotResult>("/api/admin/robot/buzzer/melody/stop", { method: "POST" }),
  buzzerStatus: () =>
    request<{ running: boolean; melody: string | null }>("/api/admin/robot/buzzer/status"),

  // ── 센서 ─────────────────────────────────────────────────────────────────────
  getSensorUltrasonic: () =>
    request<RobotResult>("/api/admin/robot/sensor/ultrasonic"),
  getSensorBattery: () =>
    request<RobotResult>("/api/admin/robot/sensor/battery"),
  getSensorIr: () =>
    request<RobotResult>("/api/admin/robot/sensor/ir"),
  getSensorImu: () =>
    request<RobotResult>("/api/admin/robot/sensor/imu"),

  // ── 모터 ─────────────────────────────────────────────────────────────────────
  motorMove: (data: MotorMoveInput) =>
    request<RobotResult>("/api/admin/robot/motor/move", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  motorStop: () =>
    request<RobotResult>("/api/admin/robot/motor/stop", { method: "POST" }),

  // ── 자율탐색 ─────────────────────────────────────────────────────────────────
  exploreStart: () =>
    request<{ ok: boolean; running: boolean; status: string; log: string[]; message: string }>(
      "/api/admin/robot/explore/start", { method: "POST" }
    ),
  exploreStop: () =>
    request<{ ok: boolean; running: boolean; status: string; log: string[]; message: string }>(
      "/api/admin/robot/explore/stop", { method: "POST" }
    ),
  exploreStatus: () =>
    request<{ running: boolean; status: string; log: string[]; message: string }>(
      "/api/admin/robot/explore/status"
    ),

  // ── 카메라 ───────────────────────────────────────────────────────────────────
  cameraStart: () =>
    request<{ success: boolean; message: string }>("/api/admin/robot/camera/start", { method: "POST" }),
  cameraStop: () =>
    request<{ success: boolean; message: string }>("/api/admin/robot/camera/stop", { method: "POST" }),
  cameraStatus: () =>
    request<{ running: boolean; error: string | null }>("/api/admin/robot/camera/status"),
  cameraAnalysis: () =>
    request<CameraAnalysis>("/api/admin/robot/camera/analysis"),

  // ── 챗봇 ─────────────────────────────────────────────────────────────────────
  executeChatCommand: (data: { session_id: string; user_message: string; robot_type: string; action: string; parameters: any }) =>
    request<{ success: boolean; response: string; bot_message: string }>("/api/admin/chat/execute", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getChatHistory: (sessionId: string) =>
    request<Array<{ id: number; role: string; content: string; created_at: string }>>(`/api/admin/chat/history?session_id=${sessionId}`),

  // ── 드라이브 타겟 ─────────────────────────────────────────────────────────────
  getDriveTarget: () =>
    request<{ target: "real" }>("/api/admin/robot/drive/target"),
  setDriveTarget: (target: "real") =>
    request<{ ok: boolean; target: "real" }>("/api/admin/robot/drive/target", {
      method: "POST",
      body: JSON.stringify({ target }),
    }),
};
