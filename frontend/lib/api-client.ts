/** Shared browser transport. Public build configuration contains no credentials. */
const TOKEN_KEY = "gamebuddy:admin-token";
const TOKEN_ORIGIN_KEY = "gamebuddy:admin-origin";
export const ADMIN_TOKEN_EVENT = "gamebuddy:admin-token-changed";
export const CONNECTION_FAILURE_EVENT = "gamebuddy:connection-failed";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); this.name = "ApiError"; }
}

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(host) || /^\[::ffff:7f[\da-f]{2}:[\da-f]{1,4}\]$/.test(host);
}

export function isLocalPage() { return typeof window !== "undefined" && isLoopback(window.location.hostname); }

export function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  const local = isLocalPage();
  if (!configured) {
    if (local) return "http://127.0.0.1:8000/api/v1";
    throw new ApiError("后端地址未配置：请在构建前设置 NEXT_PUBLIC_API_BASE_URL，指向公开后端的 /api/v1 地址，并重新构建网站。");
  }
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new ApiError("后端地址格式错误：NEXT_PUBLIC_API_BASE_URL 必须是完整的 HTTP(S) 地址。"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new ApiError("后端地址格式错误：请使用不含凭据、查询参数或片段的 HTTP(S) API 地址。");
  if (!local && (isLoopback(url.hostname) || url.hostname === "0.0.0.0" || url.hostname === "[::]")) throw new ApiError("公网网站配置了本机后端地址。请将 NEXT_PUBLIC_API_BASE_URL 改为公开后端 HTTPS 地址，并重新构建网站。");
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol !== "https:") throw new ApiError("HTTPS 网站不能连接 HTTP 后端：请配置公开后端的 HTTPS 地址并重新构建。");
  if (local && url.hostname === "localhost") url.hostname = "127.0.0.1";
  return url.href.replace(/\/+$/, "");
}

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  try {
    if (window.sessionStorage.getItem(TOKEN_ORIGIN_KEY) !== new URL(resolveApiBase()).origin) return "";
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch { return ""; }
}

export function saveAdminToken(token: string) {
  const value = token.trim();
  if (!value || value.length > 4096 || !/^[\x21-\x7e]+$/.test(value)) throw new ApiError("请输入有效的管理员令牌（ASCII 字符，不含空格或换行）。");
  const origin = new URL(resolveApiBase()).origin;
  try { window.sessionStorage.setItem(TOKEN_ORIGIN_KEY, origin); window.sessionStorage.setItem(TOKEN_KEY, value); }
  catch { throw new ApiError("当前浏览器无法保存会话令牌，请允许此网站使用会话存储后重试。"); }
  window.dispatchEvent(new Event(ADMIN_TOKEN_EVENT));
}

export function clearAdminToken() {
  try { window.sessionStorage.removeItem(TOKEN_KEY); window.sessionStorage.removeItem(TOKEN_ORIGIN_KEY); }
  catch { throw new ApiError("无法清除会话令牌，请关闭此标签页以结束管理员会话。"); }
  window.dispatchEvent(new Event(ADMIN_TOKEN_EVENT));
}

type RequestOptions = { timeoutMs?: number; root?: boolean; authorize?: boolean };

async function performRequest<T>(path: string, init: RequestInit, options: RequestOptions, read: (response: Response) => Promise<T>): Promise<T> {
  const base = resolveApiBase();
  if (!path.startsWith("/") || path.startsWith("//")) throw new ApiError("API 请求路径无效。");
  const endpoint = options.root ? new URL(path, base) : new URL(`${base}${path}`);
  const apiOrigin = new URL(base).origin;
  if (endpoint.origin !== apiOrigin) throw new ApiError("已阻止请求发送到配置之外的 API 地址。");
  const headers = new Headers(init.headers);
  headers.delete("Authorization");
  const token = options.authorize === false ? "" : getAdminToken();
  if (token && endpoint.origin === apiOrigin) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);
  try {
    const response = await fetch(endpoint.href, { ...init, headers, signal: controller.signal, cache: "no-store", credentials: "omit", redirect: "error" });
    if (!response.ok) {
      if (response.status === 401) throw new ApiError("管理员未登录或令牌无效。请到 Agent Ops 输入有效的管理员令牌；公开游戏助手仍可匿名使用。", 401);
      const body = await response.json().catch(() => null);
      const detail = body?.detail;
      if (response.status === 503) {
        const adminUnavailable = typeof detail === "string" && /admin|private|token|administrator|管理员|令牌/i.test(detail);
        throw new ApiError(adminUnavailable ? "管理员入口未配置。服务端尚未启用管理员访问，请由维护者配置令牌；公开游戏助手仍可使用。" : "后端服务暂时不可用（HTTP 503），请稍后重试连接。", 503);
      }
      const validation = Array.isArray(detail) ? detail.map((item: { loc?: (string | number)[]; msg?: string }) => `${item.loc?.filter((part) => part !== "body").join(".") || "输入"}：${item.msg || "格式不正确"}`).join("；") : null;
      throw new ApiError(typeof detail === "string" ? detail : validation || `请求失败（HTTP ${response.status}），请检查输入或重试。`, response.status);
    }
    return await read(response);
  } catch (error) {
    if ((error instanceof Error && error.name === "AbortError") || error instanceof TypeError) {
      if (!options.root && typeof window !== "undefined") window.dispatchEvent(new Event(CONNECTION_FAILURE_EVENT));
      if (error instanceof TypeError) throw new ApiError(`后端不可达：${endpoint.origin}。请确认服务运行；若健康检查地址能打开，请检查后端 CORS 是否允许当前网站。`);
      throw new ApiError(`后端请求超时：${endpoint.origin}。服务可能正在启动或暂时不可达，请重试连接。`);
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  return performRequest(path, init, options, async (response) => {
    if (response.status === 204) return undefined as T;
    try { return await response.json() as T; }
    catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError("后端返回了无法读取的数据，请重试或检查 API 配置。");
    }
  });
}

export const apiBlob = (path: string) => performRequest(path, {}, {}, (response) => response.blob());

export function jsonPost(body?: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) };
}

export type HealthInfo = { status: "ok"; mode: "public" | "local"; private_access: "configured" | "disabled" | "local"; storage: "ephemeral" | "persistent" };

export async function getBackendHealth(): Promise<HealthInfo> {
  const health = await apiRequest<HealthInfo>("/health", {}, { root: true, authorize: false, timeoutMs: 5000 });
  if (health.status !== "ok" || !["public", "local"].includes(health.mode) || !["configured", "disabled", "local"].includes(health.private_access) || !["ephemeral", "persistent"].includes(health.storage)) throw new ApiError("后端版本未提供有效的连接状态信息，请确认前后端已更新到相同版本。");
  return health;
}
