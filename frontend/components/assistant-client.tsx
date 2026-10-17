"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { WorkspaceNav } from "@/components/workspace-nav";
import { ConnectionStatus } from "@/components/connection-status";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";
import { askAssistant, type AssistantResponse, type AssistantTask } from "@/lib/ops-api";
import type { GameKey, GameState } from "@/lib/types";

const games: { value: GameKey; label: string }[] = [
  { value: "pokemon-battle-demo", label: "宝可梦对战示例" },
  { value: "moba-postmatch-demo", label: "MOBA 赛后复盘示例" },
  { value: "rpg-build-demo", label: "RPG 角色养成示例" },
];

const tasks: { value: AssistantTask; label: string; hint: string }[] = [
  { value: "qa", label: "游戏问答", hint: "例如：为什么换人时要保护自己的胜利条件？" },
  { value: "build", label: "养成建议", hint: "例如：法师资源有限，应该优先提升哪些属性？" },
  { value: "review", label: "复盘推荐", hint: "例如：落后时应该如何选择下一步行动？" },
];

const qaHints: Record<GameKey, string> = {
  "pokemon-battle-demo": "例如：为什么换人时要保护自己的胜利条件？",
  "moba-postmatch-demo": "例如：什么是 face-check，如何提前准备目标物视野？",
  "rpg-build-demo": "例如：续航和生存为什么会成为配装瓶颈？",
};

function message(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

export function AssistantClient({ samples }: { samples: Record<GameKey, string> }) {
  const [game, setGame] = useState<GameKey>("pokemon-battle-demo");
  const [task, setTask] = useState<AssistantTask>("qa");
  const [question, setQuestion] = useState("");
  const [stateText, setStateText] = useState("{}");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const { health } = useConnectionStatus();
  const { hasToken } = useAdminAccess();
  const privateAccess = health?.mode === "local" || hasToken;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("gamebuddy:user-profile");
      if (stored) setUserId(JSON.parse(stored).user_id ?? "");
    } catch { /* A malformed local profile should not prevent asking a question. */ }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!question.trim()) { setError("请先输入想解决的问题。"); return; }
    let state: GameState;
    try {
      const parsed: unknown = JSON.parse(stateText.trim() || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      state = parsed as GameState;
    } catch { setError("局势 JSON 必须是有效的对象，例如 {}；不能是数组或普通文字。"); return; }
    if (task !== "qa" && Object.keys(state).length === 0) {
      setError("养成建议与复盘推荐需要局势信息。请填写下方 JSON，或明确载入演示样例后体验。");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await askAssistant({ game, task, question: question.trim(), state, user_profile: privateAccess && userId.trim() ? { user_id: userId.trim() } : undefined });
      setResult(response);
      try { window.sessionStorage.setItem("gamebuddy:last-result", JSON.stringify(response.analysis)); } catch { /* The answer remains usable when browser storage is disabled. */ }
    } catch (cause) { setError(message(cause)); }
    finally { setLoading(false); }
  }

  return (
    <main lang="zh-CN" className="min-h-screen px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl space-y-8">
        <WorkspaceNav current="assistant" />
        <ConnectionStatus />
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ember">GameBuddy · Knowledge assistant</p>
          <h1 className="mt-3 font-display text-4xl text-ink md:text-5xl">从一个问题，找到下一步</h1>
          <p className="mt-4 text-ink/65">支持游戏问答、角色养成与复盘推荐。结合项目内知识库与可选的局势信息生成建议，并展示检索来源和证据不足的情况。</p>
        </header>
        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-ink/10 bg-white/85 p-6 shadow-card">
            <h2 className="text-xl font-semibold">描述你的问题</h2>
            <label className="block text-sm font-semibold">游戏
              <select value={game} onChange={(event) => { setGame(event.target.value as GameKey); setStateText("{}"); setError(null); }} className="mt-2 w-full rounded-2xl border border-ink/15 bg-mist px-4 py-3">
                {games.map((item) => <option key={item.value} value={item.value} disabled={task === "build" && item.value !== "rpg-build-demo"}>{item.label}</option>)}
              </select>
              {task === "build" && <span className="mt-2 block text-xs font-normal leading-5 text-ink/55">养成建议当前支持 RPG 角色。宝可梦与 MOBA 可使用游戏问答或复盘推荐。</span>}
            </label>
            <fieldset>
              <legend className="text-sm font-semibold">任务</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {tasks.map((item) => <label key={item.value} className={`cursor-pointer rounded-full border px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-ember ${task === item.value ? "border-pine bg-pine text-white" : "border-ink/10 bg-white"}`}>
                  <input type="radio" name="task" value={item.value} checked={task === item.value} onChange={() => { setTask(item.value); setError(null); if (item.value === "build" && game !== "rpg-build-demo") { setGame("rpg-build-demo"); setStateText("{}"); } }} className="sr-only" />{item.label}
                </label>)}
              </div>
            </fieldset>
            <label className="block text-sm font-semibold">问题
              <textarea required maxLength={4000} rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={task === "qa" ? qaHints[game] : tasks.find((item) => item.value === task)?.hint} className="mt-2 w-full rounded-2xl border border-ink/15 bg-mist px-4 py-3 font-normal" />
            </label>
            <label className="block text-sm font-semibold">用户 ID <span className="font-normal text-ink/55">（可选，用于读取已保存画像）</span>
              <input disabled={!privateAccess} maxLength={128} value={privateAccess ? userId : ""} onChange={(event) => setUserId(event.target.value)} placeholder={privateAccess ? "例如 player-001" : "公开演示不读取个人画像"} className="mt-2 w-full rounded-2xl border border-ink/15 bg-mist px-4 py-3 font-normal disabled:opacity-60" />
            </label>
            <details open={task !== "qa"} className="rounded-2xl bg-mist p-4">
              <summary className="cursor-pointer text-sm font-semibold">局势 JSON（{task === "qa" ? "问答可选" : "当前任务必填"}）</summary>
              <p className="mt-2 text-xs leading-5 text-ink/60">游戏问答可以直接提交。养成与复盘任务需要角色、装备、资源或对战情况等结构化信息。示例仅用于演示，可按自己的实际情况修改。</p>
              <button type="button" onClick={() => { setStateText(samples[game]); setError(null); }} className="mt-3 rounded-full border border-pine/20 bg-white px-4 py-2 text-xs font-semibold text-pine">载入{games.find((item) => item.value === game)?.label}局势</button>
              <label className="mt-3 block text-xs text-ink/65">JSON 对象
                <textarea spellCheck={false} rows={8} value={stateText} onChange={(event) => setStateText(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-3 py-3 font-mono text-xs" />
              </label>
            </details>
            {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            <button disabled={loading} type="submit" className="w-full rounded-full bg-pine px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{loading ? "检索知识并生成建议…" : "获取建议"}</button>
            <p className="text-xs leading-5 text-ink/55">知识库覆盖演示游戏的通用原则，并非完整攻略。没有知识来源支持的内容会被标记；具体玩法与版本请以游戏实际情况为准。</p>
          </form>
          <section aria-live="polite" aria-busy={loading} className="space-y-5">
            {!result && <div className="rounded-3xl border border-dashed border-ink/20 bg-white/55 p-8 text-sm text-ink/60">{loading ? "正在处理问题。完成后会显示答案、知识来源和对应的执行 Trace。" : task === "qa" ? "选择游戏并输入问题即可开始，局势信息可选。" : "请填写完整局势，或显式载入演示样例后体验。"}</div>}
            {result && <>
              <article className="rounded-3xl bg-ink p-6 text-white shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">游戏建议</h2>
                  <span className={`rounded-full px-3 py-1 text-xs ${result.evidence_status === "grounded" ? "bg-white/10 text-gold" : "bg-amber-100 text-amber-900"}`}>{result.evidence_status === "grounded" ? "有知识来源支持" : "证据不足"}</span>
                </div>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/90">{result.answer}</p>
              </article>
              {result.evidence_status === "insufficient" && <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">当前知识库未找到足够证据，回答可能只提供一般建议。请补充具体角色、装备或对局信息后再提问。</p>}
              <section className="rounded-3xl bg-white/90 p-6 shadow-card">
                <h2 className="text-lg font-semibold">检索来源 <span className="text-sm font-normal text-ink/50">{result.sources.length} 条</span></h2>
                {result.sources.length === 0 ? <p className="mt-3 text-sm text-ink/60">本次没有返回知识来源。</p> : <ol className="mt-4 space-y-3">
                  {result.sources.map((source, index) => <li key={`${source.path}-${index}`} className="rounded-2xl bg-mist p-4">
                    <p className="text-sm font-semibold">[{index + 1}] {source.source}</p>
                    <p className="mt-1 break-all font-mono text-xs text-ink/55">{source.path}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/75">{source.content}</p>
                    <p className="mt-2 text-xs text-ink/50">检索分数：{Number.isFinite(source.score) ? source.score.toFixed(3) : "—"}（相关性参考）</p>
                  </li>)}
                </ol>}
              </section>
              <div className="flex flex-wrap gap-3">
                <Link href="/review?lang=zh" className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white">查看复盘报告</Link>
                {privateAccess && <Link href={`/ops?trace_id=${encodeURIComponent(result.trace_id)}`} className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold">查看执行与标注 →</Link>}
              </div>
              {privateAccess ? <p className="break-all text-xs text-ink/50">Trace ID：{result.trace_id}</p> : <p className="text-xs text-ink/50">公开演示不保存个人历史；复盘结果仅在当前标签页临时保留。</p>}
            </>}
          </section>
        </div>
      </div>
    </main>
  );
}
