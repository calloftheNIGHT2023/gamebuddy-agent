"use client";

import Link from "next/link";
import { isLocalPage } from "@/lib/api-client";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";

export function ConnectionStatus() {
  const connection = useConnectionStatus();
  const { hasToken } = useAdminAccess();
  const local = connection.health?.mode === "local";
  const publicMode = connection.health?.mode === "public";
  return (
    <aside lang="zh-CN" className={`rounded-2xl border p-4 text-sm ${connection.error ? "border-amber-200 bg-amber-50" : "border-pine/10 bg-white/80"}`} aria-label="后端连接状态">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="font-semibold text-ink">{connection.checking ? "正在检查后端连接…" : connection.error ? "后端当前不可用" : connection.health ? `后端已连接 · ${publicMode ? "公开演示" : "本地完整版"}` : "等待检查后端连接"}</p>
        <button type="button" disabled={connection.checking} onClick={() => void connection.refresh()} className="rounded-full border border-ink/15 bg-white px-4 py-1.5 text-xs font-semibold disabled:opacity-50">{connection.checking ? "检查中…" : "重试连接"}</button>
      </div>
      {connection.apiBase && <p className="mt-2 break-all font-mono text-xs text-ink/55">API：{connection.apiBase}</p>}
      {connection.error && <div className="mt-3 space-y-2 text-xs leading-6 text-amber-950">
        <p role="alert">{connection.error}</p>
        {isLocalPage() && <p>本机演示需保持后端进程运行：在项目的 backend 文件夹执行 <code className="rounded bg-white px-1.5 py-0.5">python -m uvicorn app.main:app --host 127.0.0.1 --port 8000</code>，然后重试连接。</p>}
        {!isLocalPage() && <p>公开服务可能需要唤醒。可稍后重试；页面和小游戏可正常浏览，AI 建议需要后端恢复。</p>}
      </div>}
      {publicMode && <p className="mt-3 text-xs leading-6 text-ink/65">公开演示：匿名问答不保存个人历史、不调用付费模型。{hasToken ? "当前标签页已保存管理员令牌，私有请求仍需由后端验证。" : <>个人记忆、截图、Trace 与数据导出需要<Link href="/ops" className="font-semibold text-pine underline">管理员访问</Link>。</>}</p>}
      {local && <p className="mt-2 text-xs leading-6 text-ink/55">本地服务无需管理员令牌，可使用画像、历史与 Agent Ops。</p>}
      {connection.health?.storage === "ephemeral" && <p className="mt-2 text-xs leading-6 text-amber-900">当前后端使用临时存储，记录仅保留在当前实例，服务重启或重建后可能丢失。线上演示不代表本地完整版的持久化能力。</p>}
      {publicMode && connection.health?.private_access === "disabled" && <p className="mt-2 text-xs leading-6 text-ink/65">管理员入口未配置；当前仅开放匿名游戏助手。</p>}
      {connection.checkedAt && <p className="mt-2 text-xs text-ink/40">最近检查：{new Date(connection.checkedAt).toLocaleTimeString("zh-CN")}</p>}
    </aside>
  );
}
