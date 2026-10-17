"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { WorkspaceNav } from "@/components/workspace-nav";
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
const panel = "rounded-3xl border border-ink/10 bg-white/85 p-5 shadow-card md:p-6";
const field = "mt-2 w-full rounded-2xl border border-ink/15 bg-mist px-4 py-3 text-sm font-normal";
const primary = "rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50";
const secondary = "rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "操作失败，请重试。"; }
function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}
function formatJson(value: unknown) { return JSON.stringify(value, null, 2) ?? "无"; }
function statusName(value: string) { return ({ success: "成功", fallback: "规则回退", error: "错误" } as Record<string, string>)[value] || value; }
function statusClass(value: string) { return value === "success" ? "bg-emerald-50 text-emerald-800" : value === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"; }
function Alert({ message }: { message?: string | null }) { return message ? <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">{message}</p> : null; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-sm leading-6 text-ink/60">{children}</p>; }

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
    <main lang="zh-CN" className="min-h-screen px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl space-y-7">
        <WorkspaceNav current="ops" />
        <ConnectionStatus />
        <AdminAccess />
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ember">GameBuddy · Agent operations</p>
            <h1 className="mt-3 font-display text-4xl text-ink md:text-5xl">每次建议，都有迹可循</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">查看真实请求的执行步骤、管理策略版本、运行离线检查，并把人工反馈导出为训练数据。指标来自当前后端记录。</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading || !!working || !privateAccess} className={secondary}>{loading ? "加载中…" : "刷新数据"}</button>
        </header>
        {!privateAccess && <p role="status" className="rounded-2xl bg-mist p-5 text-sm leading-7 text-ink/65">{health?.mode === "public" ? "公开演示的管理数据需要管理员令牌。请在上方保存有效令牌后读取；匿名游戏助手仍可使用。" : "正在等待本地后端连接，或管理员令牌。请先检查上方连接状态。"}</p>}
        {privateAccess && <>
        <Alert message={errors.summary} />
        <section aria-label="运行概况" aria-busy={loading} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map(([label, value, hint]) => <article key={label} className="rounded-3xl border border-ink/10 bg-white/85 p-5 shadow-card">
            <p className="text-sm text-ink/60">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-ink/45">{hint}</p>
          </article>)}
          {loading && !summary && <p className="col-span-full py-5 text-sm text-ink/60">正在读取后端统计…</p>}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Agent Ops 功能" className="flex flex-wrap gap-2">
            {([{ value: "traces", label: "执行 Trace" }, { value: "policies", label: "策略版本" }, { value: "evaluations", label: "离线评测" }, { value: "datasets", label: "训练数据" }] as const).map((item) =>
              <button key={item.value} id={`tab-${item.value}`} role="tab" type="button" aria-selected={tab === item.value} aria-controls={`panel-${item.value}`} onClick={() => { setTab(item.value); setActionError(null); setNotice(null); }} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${tab === item.value ? "bg-ink text-white" : "bg-white/80 text-ink/65"}`}>{item.label}</button>)}
          </div>
          <p className="text-xs text-ink/55">当前策略：{errors.policies ? "读取失败" : activePolicy ? activePolicy.name : loading ? "加载中…" : "未启用"}</p>
        </div>
        <Alert message={actionError} />
        {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

        {tab === "traces" && <section role="tabpanel" id="panel-traces" aria-labelledby="tab-traces" className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className={`${panel} space-y-4`}>
            <div className="flex items-baseline justify-between"><h2 className="text-xl font-semibold">执行记录</h2><span className="text-xs text-ink/50">{visibleTraces.length} / {traces.length} 条</span></div>
            <Alert message={errors.traces} />
            <label className="block text-xs font-semibold text-ink/60">搜索问题、游戏或 Trace ID<input value={filter} onChange={(event) => setFilter(event.target.value)} className={field} placeholder="输入关键词" /></label>
            <label className="block text-xs font-semibold text-ink/60">状态<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={field}><option value="all">全部状态</option><option value="success">成功</option><option value="fallback">规则回退</option><option value="error">错误</option></select></label>
            {loading && traces.length === 0 ? <Empty>正在读取执行记录…</Empty> : !errors.traces && visibleTraces.length === 0 ? <Empty>{traces.length === 0 ? <>暂无执行记录。<Link href="/assistant" className="font-semibold text-pine underline">向游戏助手提问</Link>后即可在这里查看完整链路。</> : "没有符合筛选条件的记录。"}</Empty> : null}
            <ul className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
              {visibleTraces.map((trace) => <li key={trace.id}><button type="button" onClick={() => setSelectedId(trace.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === trace.id ? "border-pine bg-pine/5" : "border-ink/10 bg-mist/60 hover:bg-mist"}`}>
                <div className="flex flex-wrap justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-xs ${statusClass(trace.status)}`}>{statusName(trace.status)}</span><span className="text-xs text-ink/55">{trace.latency_ms.toFixed(0)} ms</span></div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold">{trace.question || "（未提供问题）"}</p><p className="mt-2 text-xs text-ink/55">{trace.game} · {trace.task}</p><p className="mt-1 text-xs text-ink/45">{dateTime(trace.created_at)}</p>
              </button></li>)}
            </ul>
          </div>
          <div className="space-y-5">
            <Alert message={traceError} />
            {traceLoading ? <div className={panel}><Empty>正在读取 Trace 详情…</Empty></div> : !selectedTrace ? <div className={panel}><Empty>选择左侧的一条真实执行记录，查看检索、工具调用、输出和耗时，并添加质量标注。</Empty></div> : <>
              <section className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">执行详情</h2><span className={`rounded-full px-3 py-1 text-xs ${statusClass(selectedTrace.status)}`}>{statusName(selectedTrace.status)}</span></div>
                <p className="mt-4 text-sm leading-6">{selectedTrace.question}</p><p className="mt-3 break-all font-mono text-xs text-ink/50">{selectedTrace.id}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-mist p-4 text-xs"><div><dt className="text-ink/50">策略版本</dt><dd className="mt-1 break-all">{selectedTrace.policy_id || "未记录"}</dd></div><div><dt className="text-ink/50">总延迟</dt><dd className="mt-1">{selectedTrace.latency_ms.toFixed(0)} ms</dd></div><div className="col-span-2"><dt className="text-ink/50">执行时间</dt><dd className="mt-1">{dateTime(selectedTrace.created_at)}</dd></div></dl>
                <h3 className="mb-3 mt-6 text-sm font-semibold">执行步骤</h3>
                {selectedTrace.steps.length === 0 ? <Empty>此记录没有步骤数据。</Empty> : <ol className="space-y-3">{selectedTrace.steps.map((step, index) => <li key={`${step.name}-${index}`} className="rounded-2xl border border-ink/10 p-4">
                  <details><summary className="cursor-pointer text-sm"><span className="mr-2 text-ember">{String(index + 1).padStart(2, "0")}</span><span className="font-semibold">{step.name}</span><span className="ml-3 text-xs text-ink/50">{step.duration_ms.toFixed(1)} ms</span></summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-mist p-3 text-xs leading-5">{formatJson(step.data)}</pre></details>
                </li>)}</ol>}
                <details className="mt-5 rounded-2xl bg-mist p-4"><summary className="cursor-pointer text-sm font-semibold">原始响应</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">{formatJson(selectedTrace.response)}</pre></details>
              </section>
              <form onSubmit={submitFeedback} className={`${panel} space-y-4`}>
                <div><h2 className="text-xl font-semibold">标注这次回答</h2><p className="mt-2 text-xs leading-5 text-ink/55">标注绑定此 Trace 的实际输入和响应。需要生成偏好数据时，请提供完整的修正回答。</p></div>
                <fieldset><legend className="text-sm font-semibold">质量评价</legend><div className="mt-2 flex flex-wrap gap-3">{([{ value: "up", label: "有用" }, { value: "down", label: "需改进" }, { value: "neutral", label: "中立" }] as const).map((item) => <label key={item.value} className="flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-sm"><input type="radio" name="rating" value={item.value} checked={rating === item.value} onChange={() => setRating(item.value)} />{item.label}</label>)}</div></fieldset>
                <label className="block text-sm font-semibold">修正回答（可选）<textarea value={correction} onChange={(event) => setCorrection(event.target.value)} maxLength={12000} rows={4} className={field} placeholder="写出更理想、可直接采用的完整回答。" /></label>
                <label className="block text-sm font-semibold">标签（可选）<input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={500} className={field} placeholder="例如：证据不足, 建议不具体" /></label>
                <button type="submit" disabled={!!working} className={primary}>{working === "feedback" ? "保存中…" : "保存反馈"}</button>
              </form>
            </>}
          </div>
        </section>}

        {tab === "policies" && <section role="tabpanel" id="panel-policies" aria-labelledby="tab-policies" className="grid items-start gap-6 lg:grid-cols-2">
          <div className={`${panel} space-y-4`}>
            <h2 className="text-xl font-semibold">已保存版本</h2><Alert message={errors.policies} />
            <p className="text-xs leading-6 text-ink/55">启用后，新请求默认使用此版本；历史 Trace 保留当时的策略 ID。可先在离线评测中选择新版本运行检查。</p>
            {policies.length === 0 && !errors.policies && <Empty>{loading ? "正在读取策略…" : "暂无策略版本，请创建第一个策略。"}</Empty>}
            {policies.map((policy) => <article key={policy.id} className="rounded-2xl border border-ink/10 bg-mist/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{policy.name}</h3>{policy.active ? <span className="rounded-full bg-pine px-3 py-1 text-xs text-white">当前启用</span> : <button type="button" disabled={!!working} className={secondary} onClick={() => void action(`activate-${policy.id}`, async () => { await activatePolicy(policy.id); setNotice(`已启用 ${policy.name}，后续请求将使用此策略。`); await refresh(); })}>{working === `activate-${policy.id}` ? "启用中…" : "启用此版本"}</button>}</div>
              <p className="mt-2 break-all font-mono text-xs text-ink/50">{policy.id}</p><p className="mt-2 text-xs text-ink/55">{dateTime(policy.created_at)} · 最多 {policy.max_next_steps} 条后续行动</p>
              <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-pine">查看提示词与约束</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/75">{policy.prompt}</p>{policy.instructions && <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-ink/65">{policy.instructions}</p>}</details>
            </article>)}
          </div>
          <form onSubmit={submitPolicy} className={`${panel} space-y-5`}>
            <div><h2 className="text-xl font-semibold">创建策略版本</h2><p className="mt-2 text-xs leading-6 text-ink/55">提示词与约束用于模型系统提示；后续行动上限也会约束本地规则输出。新版本创建后需手动启用。</p></div>
            <label className="block text-sm font-semibold">版本名称<input required maxLength={100} value={policyName} onChange={(event) => setPolicyName(event.target.value)} className={field} placeholder="例如：简洁教学 v2" /></label>
            <label className="block text-sm font-semibold">系统提示词<textarea required maxLength={8000} rows={6} value={policyPrompt} onChange={(event) => setPolicyPrompt(event.target.value)} className={field} placeholder="描述助手的角色、回答方式和证据要求。" /></label>
            <label className="block text-sm font-semibold">补充约束（每行一条）<textarea maxLength={8000} rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} className={field} placeholder="优先解释当前可执行的动作\n知识不足时明确说明" /></label>
            <label className="block text-sm font-semibold">后续行动条数上限<input required type="number" min={1} max={8} value={maxSteps} onChange={(event) => setMaxSteps(Number(event.target.value))} className={field} /></label>
            <button type="submit" disabled={!!working} className={primary}>{working === "create-policy" ? "创建中…" : "保存新版本"}</button>
          </form>
        </section>}

        {tab === "evaluations" && <section role="tabpanel" id="panel-evaluations" aria-labelledby="tab-evaluations" className="space-y-5">
          <div className={panel}>
            <h2 className="text-xl font-semibold">离线确定性检查</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">对选定策略执行后端内置检查，用于确认输出结构、功能约束与规则行为。通过数表示检查项通过情况，不等同于游戏策略准确率或线上效果。</p>
            <div className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 text-sm font-semibold">待测策略<select value={evalPolicy} onChange={(event) => setEvalPolicy(event.target.value)} className={field}><option value="">当前启用版本{activePolicy ? `（${activePolicy.name}）` : ""}</option>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} · {policy.id}</option>)}</select></label><button type="button" disabled={!!working || loading || policies.length === 0} className={primary} onClick={() => void action("evaluate", async () => { const run = await runEvaluation(evalPolicy || undefined); setNotice(`离线检查完成：${run.passed} / ${run.total} 项通过。`); await refresh(); })}>{working === "evaluate" ? "正在运行…" : "运行离线检查"}</button></div>
          </div>
          <Alert message={errors.evaluations} />
          {evaluations.length === 0 && !errors.evaluations && <Empty>{loading ? "正在读取评测记录…" : "暂无评测记录。选择策略后运行一次离线检查。"}</Empty>}
          {evaluations.map((run) => <article key={run.id} className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">{run.passed} / {run.total} 项通过</h3><p className="mt-2 break-all text-xs text-ink/55">{dateTime(run.created_at)} · 策略 {run.policy_id || "未记录"}</p></div><span className={`rounded-full px-3 py-1 text-xs ${run.passed === run.total ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{run.passed === run.total ? "全部检查通过" : "有检查未通过"}</span></div><ul className="mt-5 grid gap-3 md:grid-cols-2">{run.checks.map((check, index) => <li key={`${check.name}-${index}`} className={`rounded-2xl border p-4 ${check.passed ? "border-emerald-100 bg-emerald-50/40" : "border-amber-200 bg-amber-50"}`}><p className="text-sm font-semibold">{check.passed ? "✓" : "!"} {check.name}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-ink/65">{check.detail}</p></li>)}</ul><p className="mt-4 break-all font-mono text-xs text-ink/40">{run.id}</p></article>)}
        </section>}

        {tab === "datasets" && <section role="tabpanel" id="panel-datasets" aria-labelledby="tab-datasets" className={panel}>
          <h2 className="text-xl font-semibold">从人工反馈到训练样本</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-ink/65">导出后端真实保存的标注记录。JSONL 每行一个样本；样本数量取决于已提交反馈是否满足对应格式的条件。下载数据后可自行清洗、划分训练集与验证集。</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">{([{ value: "sft", title: "SFT 指令样本", detail: "整理输入与理想回答，优先采用人工修正内容。先在执行 Trace 中添加质量评价或完整修正回答。" }, { value: "preference", title: "Preference 偏好样本", detail: "整理同一输入下的 chosen / rejected 回答。请在真实 Trace 上提供优于原回答的完整修正内容。" }] as const).map((dataset) => <article key={dataset.value} className="rounded-3xl bg-mist p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember">{dataset.value}.jsonl</p><h3 className="mt-3 text-xl font-semibold">{dataset.title}</h3><p className="mt-3 text-sm leading-6 text-ink/65">{dataset.detail}</p><button type="button" disabled={!!working} className={`mt-5 ${primary}`} onClick={() => void action(`export-${dataset.value}`, async () => { await downloadSamples(dataset.value); setNotice(`${dataset.title}已导出。`); })}>{working === `export-${dataset.value}` ? "导出中…" : "下载 JSONL"}</button></article>)}</div>
          <p className="mt-5 text-xs leading-6 text-ink/55">反馈保存与样本导出构成数据整理链路；当前页面不执行模型训练。</p>
        </section>}
        </>}
      </div>
    </main>
  );
}
