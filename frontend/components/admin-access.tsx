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
    try { saveAdminToken(token); setToken(""); setMessage("令牌已保存到当前标签页，正在重新请求管理数据；能否访问由后端验证。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "令牌保存失败。"); }
  }
  function clear() {
    setError(null); setMessage(null);
    try { clearAdminToken(); setToken(""); setMessage("管理员令牌已清除。公开游戏助手仍可使用。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "令牌清除失败。"); }
  }
  return (
    <section className="rounded-3xl border border-ink/10 bg-white/85 p-5 shadow-card">
      <h2 className="text-lg font-semibold">管理员访问 <span className="ml-2 text-xs font-normal text-ink/50">{health?.mode === "local" ? "本地无需令牌" : hasToken ? "当前标签页已保存令牌" : "未登录"}</span></h2>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-ink/60">公网 Trace、Policy、评测、个人记忆与导出仅向管理员开放。令牌只保存在当前标签页的会话存储中，仅发送给已配置的 API；关闭标签页或手动清除后结束会话。</p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 text-sm font-semibold">管理员令牌
          <input type="password" autoComplete="off" spellCheck={false} maxLength={4096} required value={token} onChange={(event) => setToken(event.target.value)} placeholder="由服务维护者提供" className="mt-2 w-full rounded-2xl border border-ink/15 bg-mist px-4 py-3 font-normal" />
        </label>
        <button type="submit" className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white">保存并连接</button>
        <button type="button" onClick={clear} className="rounded-full border border-ink/15 bg-white px-5 py-3 text-sm font-semibold">清除令牌</button>
      </form>
      {health?.private_access === "disabled" && <p className="mt-3 text-xs leading-6 text-amber-900">当前服务尚未配置管理员令牌，输入令牌也无法启用管理功能。请由服务维护者完成后端配置。</p>}
      {message && <p role="status" className="mt-3 text-sm text-pine">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </section>
  );
}
