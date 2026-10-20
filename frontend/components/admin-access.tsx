"use client";

import { FormEvent, useState } from "react";
import { clearAdminToken, saveAdminToken } from "@/lib/api-client";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";

export function AdminAccess() {
  const { hasToken } = useAdminAccess();
  const { health } = useConnectionStatus();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null);
    try { saveAdminToken(token); setToken(""); setMessage("令牌已保存，正在连接。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "令牌保存失败。"); }
  }
  function clear() {
    setError(null); setMessage(null);
    try { clearAdminToken(); setToken(""); setMessage("令牌已清除。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "令牌清除失败。"); }
  }
  if (health?.mode === "local" && !hasToken) return null;
  return (
    <details className="border border-ink/25 bg-white" open={health?.mode === "public" && !hasToken && health.private_access === "configured"}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs font-semibold">
        <span>管理员访问 <span className="ml-3 font-mono text-[10px] font-normal text-ink/65">PRIVATE ACCESS</span></span>
        <span className="font-normal text-ink/65">{health?.mode === "local" ? "本地无需令牌" : hasToken ? "已保存会话令牌 / 管理" : "未登录 / 展开"}</span>
      </summary>
      <div className="border-t border-ink/20 p-4">
        <p className="max-w-3xl text-xs leading-6 text-ink/65">用于读取玩家档案、历史与管理数据。令牌保存在当前标签页，可随时清除。</p>
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 text-xs font-semibold">管理员令牌
            <input type="password" autoComplete="off" spellCheck={false} maxLength={4096} required value={token} onChange={(event) => setToken(event.target.value)} placeholder="由服务维护者提供" className="gb-field mt-1.5 w-full border border-ink/30 bg-[#f7f6f1] px-3 py-2.5 text-sm font-normal" />
          </label>
          <button type="submit" className="gb-button border border-ink bg-ink px-4 py-2.5 text-xs font-semibold text-white">保存并连接 ↗</button>
          <button type="button" onClick={clear} className="border border-ink/25 px-4 py-2.5 text-xs font-semibold">清除令牌</button>
        </form>
        {health?.private_access === "disabled" && <p className="mt-3 border-l-2 border-[#f05a32] pl-3 text-xs leading-6 text-ink/70">管理员入口未配置，请联系维护者。</p>}
        {message && <p role="status" className="mt-3 text-xs leading-6 text-ink">{message}</p>}
        {error && <p role="alert" className="mt-3 text-xs leading-6 text-[#ab351a]">{error}</p>}
      </div>
    </details>
  );
}
