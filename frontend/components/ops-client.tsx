"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { SiteFooter, WorkspaceNav } from "@/components/workspace-nav";
import { AdminAccess } from "@/components/admin-access";
import { ConnectionStatus } from "@/components/connection-status";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";
import {
  activatePolicy, annotateTrace, createPolicy, downloadSamples, getEvaluations, getOpsSummary, getPolicies, getTrace, getTraces, runEvaluation,
  type AgentPolicy, type AgentTrace, type EvaluationRun, type OpsSummary,
} from "@/lib/ops-api";
import type { FeedbackRating } from "@/lib/types";

type Tab = "traces" | "policies" | "evaluations" | "datasets";
type SectionKey = "summary" | "traces" | "policies" | "evaluations";
const panel = "gb-panel border border-ink/25 bg-white p-4 md:p-5";
const field = "gb-field mt-1.5 w-full border border-ink/25 bg-[#f7f6f1] px-3 py-2.5 text-xs font-normal";
const primary = "gb-button border border-ink bg-ink px-4 py-2.5 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-40";
const secondary = "border border-ink/30 bg-white px-3 py-2 text-xs font-semibold hover:bg-[#e5f36a] disabled:opacity-40";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "操作失败，请重试。"; }
function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}
function formatJson(value: unknown) { return JSON.stringify(value, null, 2) ?? "无"; }
function statusName(value: string) { return ({ success: "成功", fallback: "规则回退", error: "错误" } as Record<string, string>)[value] || value; }
function statusClass(value: string) { return value === "success" ? "bg-[#e5f36a] text-ink" : value === "error" ? "bg-[#f05a32] text-white" : "bg-[#e4e0d4] text-ink"; }
function Alert({ message }: { message?: string | null }) { return message ? <p role="alert" className="border-l-2 border-[#f05a32] bg-[#fce8df] px-3 py-2 text-xs leading-6 text-[#9b3018]">{message}</p> : null; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="border-y border-dashed border-ink/20 px-4 py-8 text-xs leading-6 text-ink/65">{children}</p>; }

export function OpsClient() {
  const [tab, setTab] = useState<Tab>("traces");
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [policies, setPolicies] = useState<AgentPolicy[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRun[]>([]);
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [selectedTrace, setSelectedTrace] = useState<AgentTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rating, setRating] = useState<FeedbackRating>("up");
  const [correction, setCorrection] = useState("");
  const [tags, setTags] = useState("");
  const [policyName, setPolicyName] = useState("");
  const [policyPrompt, setPolicyPrompt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxSteps, setMaxSteps] = useState(4);
  const [evalPolicy, setEvalPolicy] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { health } = useConnectionStatus();
  const { hasToken, revision } = useAdminAccess();
  const privateAccess = health?.mode === "local" || hasToken;
  const refreshRevision = useRef(0);

  const refresh = useCallback(async () => {
    const requestRevision = ++refreshRevision.current;
    setLoading(true);
    const keys: SectionKey[] = ["summary", "traces", "policies", "evaluations"];
    const results = await Promise.allSettled([getOpsSummary(), getTraces(), getPolicies(), getEvaluations()]);
    if (requestRevision !== refreshRevision.current) return;
    const nextErrors: Partial<Record<SectionKey, string>> = {};
    results.forEach((result, index) => { if (result.status === "rejected") nextErrors[keys[index]] = errorMessage(result.reason); });
    if (results[0].status === "fulfilled") setSummary(results[0].value as OpsSummary); else setSummary(null);
    if (results[1].status === "fulfilled") setTraces(results[1].value as AgentTrace[]); else setTraces([]);
    if (results[2].status === "fulfilled") setPolicies(results[2].value as AgentPolicy[]); else setPolicies([]);
    if (results[3].status === "fulfilled") setEvaluations(results[3].value as EvaluationRun[]); else setEvaluations([]);
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    const traceId = new URLSearchParams(window.location.search).get("trace_id");
    if (traceId) setSelectedId(traceId);
  }, []);

  useEffect(() => {
    refreshRevision.current += 1;
    setSummary(null); setTraces([]); setPolicies([]); setEvaluations([]); setSelectedTrace(null);
    setErrors({}); setActionError(null); setNotice(null);
    if (privateAccess) void refresh(); else setLoading(false);
    return () => { refreshRevision.current += 1; };
  }, [refresh, privateAccess, revision]);

  useEffect(() => {
    let current = true;
    setSelectedTrace(null);
    setTraceError(null);
    setCorrection("");
    setTags("");
    setRating("up");
    setNotice(null);
    setActionError(null);
    if (!selectedId || !privateAccess) { setTraceLoading(false); return; }
    setTraceLoading(true);
    getTrace(selectedId).then((trace) => { if (current) setSelectedTrace(trace); })
      .catch((error) => { if (current) setTraceError(errorMessage(error)); })
      .finally(() => { if (current) setTraceLoading(false); });
    return () => { current = false; };
  }, [selectedId, privateAccess, revision]);

  async function action(key: string, operation: () => Promise<void>) {
    setWorking(key); setActionError(null); setNotice(null);
    try { await operation(); }
    catch (error) { setActionError(errorMessage(error)); }
    finally { setWorking(null); }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTrace) return;
    const traceId = selectedTrace.id;
    await action("feedback", async () => {
      await annotateTrace(traceId, { rating, correction: correction.trim() || undefined, tags: tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean) });
      setNotice(`Trace ${traceId} 的反馈已保存，可在数据导出中整理训练样本。`);
      await refresh();
    });
  }

  async function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action("create-policy", async () => {
      if (!policyName.trim() || !policyPrompt.trim()) throw new Error("策略名称和提示词不能为空。");
      const policy = await createPolicy({ name: policyName.trim(), prompt: policyPrompt.trim(), instructions: instructions.trim(), max_next_steps: maxSteps });
      setPolicyName(""); setPolicyPrompt(""); setInstructions(""); setMaxSteps(4);
      setNotice(`已创建策略 ${policy.name}。评测通过后可手动启用。`);
      await refresh();
    });
  }

  const visibleTraces = traces.filter((trace) => (statusFilter === "all" || trace.status === statusFilter) && `${trace.id} ${trace.question} ${trace.game} ${trace.task}`.toLowerCase().includes(filter.toLowerCase()));
  const activePolicy = policies.find((policy) => policy.active);
  const metrics = summary ? [
    ["总请求", summary.total_requests, "已记录执行"],
    ["成功", summary.success_count, "返回可用结果（含回退）"],
    ["规则回退", summary.fallback_count, "使用本地规则兜底"],
    ["平均延迟", `${summary.avg_latency_ms.toFixed(0)} ms`, "后端记录"],
    ["反馈", summary.feedback_count, "人工质量标注"],
    ["评测运行", summary.eval_runs, "离线检查批次"],
  ] : [];

  return (
    <main lang="zh-CN" className="gb-page min-h-screen px-5 py-5 md:px-9 lg:px-12">
      <div className="mx-auto max-w-[1600px]">
        <WorkspaceNav current="ops" />
        <header className="flex flex-wrap items-end justify-between gap-4 py-6">
          <div><p className="gb-kicker font-mono text-[10px] uppercase tracking-[0.16em] text-ink/65">BACK OFFICE / 运行档案</p><h1 className="mt-2 text-3xl font-black tracking-tight">运营工作台<span className="ml-3 align-middle font-mono text-[10px] font-normal tracking-normal text-ink/65">AGENT OPS</span></h1></div>
          <button type="button" onClick={() => void refresh()} disabled={loading || !!working || !privateAccess} className={secondary}>{loading ? "读取中…" : "刷新数据 ↻"}</button>
        </header>
        <ConnectionStatus />
        <div className="mt-5"><AdminAccess /></div>
        <div className="mt-5 grid min-w-0 border-t border-ink/30 lg:grid-cols-[150px_minmax(0,1fr)]">
          <aside className="border-b border-ink/25 py-4 lg:border-b-0 lg:border-r lg:pr-4">
            <p className="mb-4 hidden font-mono text-[10px] text-ink/65 lg:block">WORKSPACE / 04</p>
            <div role="tablist" aria-label="Agent Ops 功能" className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1" onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              if (!buttons.length) return;
              const current = Math.max(0, buttons.findIndex((button) => button === document.activeElement));
              const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
              event.preventDefault(); buttons[next].focus(); buttons[next].click();
            }}>
              {([{ value: "traces", label: "执行记录", code: "01" }, { value: "policies", label: "策略版本", code: "02" }, { value: "evaluations", label: "离线评测", code: "03" }, { value: "datasets", label: "训练数据", code: "04" }] as const).map((item) =>
                <button key={item.value} id={`tab-${item.value}`} role="tab" type="button" tabIndex={tab === item.value ? 0 : -1} aria-selected={tab === item.value} aria-controls={`panel-${item.value}`} onClick={() => { setTab(item.value); setActionError(null); setNotice(null); }} className={`flex items-center gap-3 border px-3 py-3 text-left text-xs font-semibold ${tab === item.value ? "border-ink bg-ink text-white" : "border-transparent text-ink/65 hover:border-ink/20"}`}><span className={`font-mono text-[10px] ${tab === item.value ? "text-[#e5f36a]" : "text-ink/65"}`}>{item.code}</span>{item.label}</button>)}
            </div>
            <div className="mt-6 hidden border-t border-ink/20 pt-4 lg:block"><p className="font-mono text-[10px] text-ink/65">ACTIVE POLICY</p><p className="mt-2 break-words text-[11px] leading-5">{!privateAccess ? "需管理员访问" : errors.policies ? "读取失败" : activePolicy ? activePolicy.name : loading ? "读取中…" : "未启用"}</p></div>
          </aside>
          <div className="min-w-0 space-y-5 py-5 lg:pl-5">
            {!privateAccess && <section className="border border-ink/25 bg-white px-6 py-12 md:px-10">
              <p className="font-mono text-[10px] text-[#d34524]">PRIVATE WORKSPACE</p><h2 className="mt-5 text-2xl font-black">管理记录，先验证访问。</h2>
              <p role="status" className="mt-4 max-w-xl text-sm leading-7 text-ink/65">{health?.mode === "public" ? "公开演示不开放运行记录、策略与数据导出。请在上方管理员入口保存有效令牌；匿名游戏助手仍可使用。" : "工作台正在等待本地后端连接，或管理员令牌。请先检查连接状态。"}</p>
              <Link href="/assistant" className="mt-6 inline-flex border-b border-ink pb-1 text-xs font-bold">返回游戏助手 ↗</Link>
            </section>}
            {privateAccess && <>
              <Alert message={errors.summary} />
              <section aria-label="运行概况" aria-busy={loading} className="grid grid-cols-2 border-y border-ink/30 sm:grid-cols-3 xl:grid-cols-6">
                {metrics.map(([label, value, hint]) => <article key={label} className="border-r border-ink/15 px-4 py-3 last:border-r-0"><p className="text-[10px] text-ink/65">{label}</p><p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-[10px] leading-4 text-ink/65">{hint}</p></article>)}
                {loading && !summary && <p className="col-span-full px-4 py-5 text-xs text-ink/65">正在读取后端统计…</p>}
              </section>
              <Alert message={actionError} />
              {notice && <p role="status" className="border-l-2 border-ink bg-[#e5f36a]/40 px-3 py-2 text-xs leading-6">{notice}</p>}

              {tab === "traces" && <section role="tabpanel" id="panel-traces" aria-labelledby="tab-traces" className="grid min-w-0 items-start gap-5 xl:grid-cols-[1.12fr_0.88fr]">
                <div className="min-w-0 border border-ink/25 bg-white">
                  <div className="flex items-baseline justify-between border-b border-ink/25 px-4 py-3"><h2 className="text-sm font-bold">执行记录</h2><span className="font-mono text-[10px] text-ink/65">{visibleTraces.length} / {traces.length}</span></div>
                  <div className="space-y-3 border-b border-ink/20 p-4"><Alert message={errors.traces} /><div className="grid grid-cols-[minmax(0,1fr)_115px] gap-2"><label className="text-[10px] font-semibold text-ink/65">搜索问题 / 游戏 / ID<input value={filter} onChange={(event) => setFilter(event.target.value)} className={field} placeholder="关键词" /></label><label className="text-[10px] font-semibold text-ink/65">状态<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={field}><option value="all">全部</option><option value="success">成功</option><option value="fallback">规则回退</option><option value="error">错误</option></select></label></div></div>
                  {loading && traces.length === 0 ? <Empty>正在读取执行记录…</Empty> : !errors.traces && visibleTraces.length === 0 ? <Empty>{traces.length === 0 ? <>暂无执行记录。<Link href="/assistant" className="border-b border-ink font-semibold text-ink">向游戏助手提问</Link>后可查看完整链路。</> : "没有符合筛选条件的记录。"}</Empty> : null}
                  {visibleTraces.length > 0 && <div className="max-h-[640px] overflow-auto"><table className="w-full min-w-[380px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#efeee8] font-mono text-[10px] text-ink/65"><tr><th className="px-4 py-2 font-normal">REQUEST / GAME</th><th className="px-2 py-2 font-normal">STATE</th><th className="px-3 py-2 text-right font-normal">MS</th></tr></thead><tbody className="divide-y divide-ink/15">{visibleTraces.map((trace) => <tr key={trace.id} className={selectedId === trace.id ? "bg-[#e5f36a]/30" : "hover:bg-[#f5f4ef]"}>
                    <td className="border-l-2 border-transparent p-0"><button type="button" onClick={() => setSelectedId(trace.id)} aria-pressed={selectedId === trace.id} className={`block w-full border-l-2 px-3 py-3 text-left ${selectedId === trace.id ? "border-[#f05a32]" : "border-transparent"}`}><span className="line-clamp-2 text-xs font-semibold leading-5">{trace.question || "（未提供问题）"}</span><span className="mt-1 block font-mono text-[10px] leading-4 text-ink/65">{trace.game} / {trace.task}</span><span className="mt-1 block text-[10px] text-ink/65">{dateTime(trace.created_at)}</span></button></td>
                    <td className="px-2 py-3 align-top"><span className={`inline-block whitespace-nowrap px-1.5 py-1 text-[10px] ${statusClass(trace.status)}`}>{statusName(trace.status)}</span></td><td className="px-3 py-3 text-right align-top font-mono text-[10px] tabular-nums">{trace.latency_ms.toFixed(0)}</td>
                  </tr>)}</tbody></table></div>}
                </div>
                <div className="min-w-0 space-y-4"><Alert message={traceError} />
                  {traceLoading ? <div className={panel}><Empty>正在读取执行详情…</Empty></div> : !selectedTrace ? <div className={`${panel} min-h-64`}><p className="font-mono text-[10px] text-ink/65">TRACE INSPECTOR</p><p className="mt-10 text-lg font-bold">选择一条记录。</p><p className="mt-3 text-xs leading-6 text-ink/65">查看检索、工具调用、原始输出和耗时，或为实际回答添加质量标注。</p></div> : <>
                    <section className={panel}>
                      <div className="flex items-center justify-between gap-2 border-b border-ink/20 pb-3"><h2 className="text-sm font-bold">执行详情</h2><span className={`px-2 py-1 text-[10px] ${statusClass(selectedTrace.status)}`}>{statusName(selectedTrace.status)}</span></div>
                      <p className="mt-4 text-sm font-semibold leading-6">{selectedTrace.question}</p><p className="mt-2 break-all font-mono text-[10px] text-ink/65">{selectedTrace.id}</p>
                      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-ink/20 py-3 text-[10px]"><div><dt className="text-ink/65">策略版本</dt><dd className="mt-1 break-all font-mono">{selectedTrace.policy_id || "未记录"}</dd></div><div><dt className="text-ink/65">总延迟</dt><dd className="mt-1 font-mono">{selectedTrace.latency_ms.toFixed(0)} ms</dd></div><div className="col-span-2"><dt className="text-ink/65">执行时间</dt><dd className="mt-1">{dateTime(selectedTrace.created_at)}</dd></div></dl>
                      <h3 className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-wider text-ink/65">Execution steps</h3>
                      {selectedTrace.steps.length === 0 ? <Empty>此记录没有步骤数据。</Empty> : <ol className="divide-y divide-ink/15 border-y border-ink/15">{selectedTrace.steps.map((step, index) => <li key={`${step.name}-${index}`}><details className="py-3"><summary className="cursor-pointer text-xs"><span className="mr-3 font-mono text-[10px] text-[#d34524]">{String(index + 1).padStart(2, "0")}</span><span className="font-semibold">{step.name}</span><span className="ml-3 font-mono text-[10px] text-ink/65">{step.duration_ms.toFixed(1)} ms</span></summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words border-l border-ink/20 bg-[#f7f6f1] p-3 text-[10px] leading-5">{formatJson(step.data)}</pre></details></li>)}</ol>}
                      <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold">原始响应 / JSON</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-ink/20 bg-[#f7f6f1] p-3 text-[10px] leading-5">{formatJson(selectedTrace.response)}</pre></details>
                    </section>
                    <form onSubmit={submitFeedback} className={`${panel} space-y-4`}>
                      <div><h2 className="text-sm font-bold">标注这次回答</h2><p className="mt-2 text-[10px] leading-5 text-ink/65">绑定实际输入与响应。偏好数据需要优于原回答的完整修正内容。</p></div>
                      <fieldset><legend className="text-[10px] font-semibold">质量评价</legend><div className="mt-2 flex flex-wrap gap-4">{([{ value: "up", label: "有用" }, { value: "down", label: "需改进" }, { value: "neutral", label: "中立" }] as const).map((item) => <label key={item.value} className="flex items-center gap-1.5 text-xs"><input type="radio" name="rating" value={item.value} checked={rating === item.value} onChange={() => setRating(item.value)} className="accent-[#f05a32]" />{item.label}</label>)}</div></fieldset>
                      <label className="block text-[10px] font-semibold">修正回答（可选）<textarea value={correction} onChange={(event) => setCorrection(event.target.value)} maxLength={12000} rows={4} className={field} placeholder="写出可直接采用的完整回答。" /></label>
                      <label className="block text-[10px] font-semibold">标签（可选）<input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={500} className={field} placeholder="例如：证据不足, 建议不具体" /></label>
                      <button type="submit" disabled={!!working} className={primary}>{working === "feedback" ? "保存中…" : "保存反馈 ↗"}</button>
                    </form>
                  </>}
                </div>
              </section>}

              {tab === "policies" && <section role="tabpanel" id="panel-policies" aria-labelledby="tab-policies" className="grid items-start gap-5 xl:grid-cols-2">
                <div className="min-w-0 border border-ink/25 bg-white"><div className="border-b border-ink/25 px-4 py-3"><h2 className="text-sm font-bold">版本目录</h2></div><div className="p-4"><Alert message={errors.policies} /><p className="text-[11px] leading-6 text-ink/65">新请求使用启用版本；历史记录保留当时的策略 ID。可先完成离线检查，再手动启用。</p></div>
                  {policies.length === 0 && !errors.policies && <Empty>{loading ? "正在读取策略…" : "暂无策略版本，请创建第一个策略。"}</Empty>}
                  <div className="divide-y divide-ink/20">{policies.map((policy) => <article key={policy.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">{policy.name}</h3>{policy.active ? <span className="border border-ink/20 bg-[#e5f36a] px-2 py-1 text-[10px]">当前启用</span> : <button type="button" disabled={!!working} className={secondary} onClick={() => void action(`activate-${policy.id}`, async () => { await activatePolicy(policy.id); setNotice(`已启用 ${policy.name}，后续请求将使用此策略。`); await refresh(); })}>{working === `activate-${policy.id}` ? "启用中…" : "启用 ↗"}</button>}</div><p className="mt-2 break-all font-mono text-[10px] text-ink/65">{policy.id}</p><p className="mt-2 text-[10px] text-ink/65">{dateTime(policy.created_at)} · 最多 {policy.max_next_steps} 条行动</p><details className="mt-3"><summary className="cursor-pointer text-[11px] font-semibold">提示词与约束</summary><p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-ink/70">{policy.prompt}</p>{policy.instructions && <p className="mt-3 whitespace-pre-wrap border-l border-ink/20 pl-3 text-[11px] leading-6 text-ink/65">{policy.instructions}</p>}</details></article>)}</div>
                </div>
                <form onSubmit={submitPolicy} className={`${panel} space-y-4`}><div><p className="font-mono text-[10px] text-[#d34524]">NEW VERSION</p><h2 className="mt-2 text-lg font-bold">创建策略版本</h2><p className="mt-2 text-[11px] leading-6 text-ink/65">提示词与约束用于模型系统提示；行动上限也约束本地规则输出。创建后需手动启用。</p></div><label className="block text-xs font-semibold">版本名称<input required maxLength={100} value={policyName} onChange={(event) => setPolicyName(event.target.value)} className={field} placeholder="例如：简洁教学 v2" /></label><label className="block text-xs font-semibold">系统提示词<textarea required maxLength={8000} rows={6} value={policyPrompt} onChange={(event) => setPolicyPrompt(event.target.value)} className={field} placeholder="描述角色、回答方式与证据要求。" /></label><label className="block text-xs font-semibold">补充约束（每行一条）<textarea maxLength={8000} rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} className={field} placeholder="优先解释当前可执行的动作" /></label><label className="block text-xs font-semibold">行动条数上限<input required type="number" min={1} max={8} value={maxSteps} onChange={(event) => setMaxSteps(Number(event.target.value))} className={field} /></label><button type="submit" disabled={!!working} className={primary}>{working === "create-policy" ? "创建中…" : "保存新版本 ↗"}</button></form>
              </section>}

              {tab === "evaluations" && <section role="tabpanel" id="panel-evaluations" aria-labelledby="tab-evaluations" className="space-y-4">
                <div className={panel}><div className="grid gap-5 xl:grid-cols-[1fr_1fr]"><div><p className="font-mono text-[10px] text-[#d34524]">OFFLINE CHECKS</p><h2 className="mt-2 text-lg font-bold">离线确定性检查</h2><p className="mt-3 text-[11px] leading-6 text-ink/65">检查输出结构、功能约束与规则行为。通过数不等同于游戏策略准确率或线上效果。</p></div><div className="flex flex-wrap items-end gap-2"><label className="min-w-48 flex-1 text-xs font-semibold">待测策略<select value={evalPolicy} onChange={(event) => setEvalPolicy(event.target.value)} className={field}><option value="">当前启用版本{activePolicy ? `（${activePolicy.name}）` : ""}</option>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} · {policy.id}</option>)}</select></label><button type="button" disabled={!!working || loading || policies.length === 0} className={primary} onClick={() => void action("evaluate", async () => { const run = await runEvaluation(evalPolicy || undefined); setNotice(`离线检查完成：${run.passed} / ${run.total} 项通过。`); await refresh(); })}>{working === "evaluate" ? "正在运行…" : "运行检查 ↗"}</button></div></div></div>
                <Alert message={errors.evaluations} />{evaluations.length === 0 && !errors.evaluations && <Empty>{loading ? "正在读取评测记录…" : "暂无评测记录。选择策略后运行一次离线检查。"}</Empty>}
                {evaluations.map((run) => <article key={run.id} className="border border-ink/25 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/25 px-4 py-4"><div><h3 className="font-mono text-lg font-semibold">{run.passed} <span className="text-ink/65">/ {run.total}</span><span className="ml-3 font-sans text-xs font-normal">项通过</span></h3><p className="mt-2 break-all text-[10px] text-ink/65">{dateTime(run.created_at)} · 策略 {run.policy_id || "未记录"}</p></div><span className={`border border-ink/20 px-2 py-1 text-[10px] ${run.passed === run.total ? "bg-[#e5f36a]" : "bg-[#fce8df]"}`}>{run.passed === run.total ? "全部通过" : "有未通过项"}</span></div><ul className="divide-y divide-ink/15">{run.checks.map((check, index) => <li key={`${check.name}-${index}`} className="grid gap-1 px-4 py-3 text-xs md:grid-cols-[230px_minmax(0,1fr)]"><p className="font-semibold"><span className={`mr-2 font-mono text-[10px] ${check.passed ? "text-[#617022]" : "text-[#d34524]"}`}>{check.passed ? "PASS" : "FAIL"}</span>{check.name}</p><p className="whitespace-pre-wrap text-[11px] leading-6 text-ink/65">{check.detail}</p></li>)}</ul><p className="border-t border-ink/15 px-4 py-2 font-mono text-[10px] text-ink/65">{run.id}</p></article>)}
              </section>}

              {tab === "datasets" && <section role="tabpanel" id="panel-datasets" aria-labelledby="tab-datasets" className="border border-ink/25 bg-white">
                <div className="border-b border-ink/25 p-5"><p className="font-mono text-[10px] text-[#d34524]">REVIEWED DATA</p><h2 className="mt-2 text-lg font-bold">从人工反馈到训练样本</h2><p className="mt-3 max-w-3xl text-xs leading-7 text-ink/65">导出后端真实保存的标注。JSONL 每行一个样本；数量取决于反馈是否满足对应条件。下载后可自行清洗与划分数据。</p></div>
                <div className="divide-y divide-ink/20">{([{ value: "sft", title: "SFT 指令样本", detail: "整理输入与理想回答，优先采用人工修正内容。先为真实记录添加质量评价或完整修正回答。" }, { value: "preference", title: "Preference 偏好样本", detail: "整理同一输入下的 chosen / rejected 回答，需要优于原回答的完整修正内容。" }] as const).map((dataset, index) => <article key={dataset.value} className="grid items-start gap-4 p-5 md:grid-cols-[42px_minmax(0,1fr)_auto]"><span className="font-mono text-sm text-ink/65">{String(index + 1).padStart(2, "0")}</span><div><h3 className="text-base font-bold">{dataset.title}</h3><p className="mt-1 font-mono text-[10px] uppercase text-ink/65">{dataset.value}.jsonl</p><p className="mt-3 max-w-xl text-xs leading-6 text-ink/65">{dataset.detail}</p></div><button type="button" disabled={!!working} className={secondary} onClick={() => void action(`export-${dataset.value}`, async () => { await downloadSamples(dataset.value); setNotice(`${dataset.title}已导出。`); })}>{working === `export-${dataset.value}` ? "导出中…" : "下载 JSONL ↓"}</button></article>)}</div>
                <p className="border-t border-ink/20 px-5 py-3 text-[10px] leading-5 text-ink/65">此处完成反馈与数据整理，不执行模型训练。</p>
              </section>}
            </>}
          </div>
        </div>
        <SiteFooter />
      </div>
    </main>
  );
}
