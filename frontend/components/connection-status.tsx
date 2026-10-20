"use client";

import Link from "next/link";
import { isLocalPage } from "@/lib/api-client";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";

export function ConnectionStatus() {
  const connection = useConnectionStatus();
  const { hasToken } = useAdminAccess();
  const local = connection.health?.mode === "local";
  const publicMode = connection.health?.mode === "public";
  const status = connection.checking ? "连接检查中" : connection.error ? "后端不可用" : connection.health ? "服务在线" : "等待连接";
  return (
    <aside lang="zh-CN" className="border-y border-ink/20 text-xs" aria-label="后端连接状态">
      <div className="flex items-start gap-3">
        <details className="group min-w-0 flex-1">
          <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 py-2 text-ink/65">
            <span role="status" className="inline-flex items-center gap-2 font-semibold text-ink"><span className={`h-1.5 w-1.5 ${connection.error ? "bg-[#f05a32]" : connection.health ? "bg-[#71812d]" : "bg-ink/30"}`} />{status}</span>
            {connection.health && <span>{publicMode ? "公开演示" : "本地完整版"}</span>}
            {connection.health?.storage === "ephemeral" && <span>临时存储</span>}
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider group-open:text-ink">DETAILS +</span>
          </summary>
          <div className="space-y-2 border-t border-ink/15 py-3 text-xs leading-6 text-ink/65">
            {connection.apiBase && <p className="break-all font-mono text-[11px]">API / {connection.apiBase}</p>}
            {connection.error && <>
              <p role="alert" className="text-[#ab351a]">{connection.error}</p>
              {isLocalPage() ? <p>在项目根目录运行 <code className="bg-white px-1 py-0.5 text-[11px]">.\scripts\start-local.ps1</code> 可启动前后端，随后重试连接。</p> : <p>公开服务可能需要唤醒，请稍后重试。页面和小游戏可继续浏览，分析功能需要后端恢复。</p>}
            </>}
            {publicMode && <p>匿名问答不保存个人历史、不调用付费模型。{hasToken ? "此标签页已保存管理员令牌，私有访问仍由后端验证。" : <>个人记忆、截图和运行记录需要<Link href="/ops" className="ml-1 border-b border-ink font-semibold text-ink">管理员访问</Link>。</>}</p>}
            {local && <p>本地无需管理员令牌，可使用画像、历史与运行记录。</p>}
            {connection.health?.storage === "ephemeral" && <p>记录仅保留在当前实例，服务重启或重建后可能丢失；线上演示不代表本地完整版的持久化能力。</p>}
            {publicMode && connection.health?.private_access === "disabled" && <p>管理员入口未配置，当前仅开放匿名游戏助手。</p>}
            {connection.checkedAt && <p className="font-mono text-[10px] text-ink/65">CHECKED / {new Date(connection.checkedAt).toLocaleTimeString("zh-CN")}</p>}
          </div>
        </details>
        <button type="button" disabled={connection.checking} onClick={() => void connection.refresh()} className="my-2 shrink-0 border-l border-ink/20 pl-3 text-[11px] font-semibold disabled:opacity-40">{connection.checking ? "检查中…" : "重试连接 ↗"}</button>
      </div>
    </aside>
  );
}
