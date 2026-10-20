"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { SiteFooter, WorkspaceNav } from "@/components/workspace-nav";
import { ConnectionStatus } from "@/components/connection-status";
import { GameArt, gameArtwork } from "@/components/game-art";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";
import { askAssistant, type AssistantResponse, type AssistantTask } from "@/lib/ops-api";
import type { GameKey, GameState } from "@/lib/types";

const games: { value: GameKey; label: string }[] = [
  { value: "pokemon-battle-demo", label: "宝可梦对战" },
  { value: "moba-postmatch-demo", label: "MOBA 复盘" },
  { value: "rpg-build-demo", label: "RPG 配装" },
];

const tasks: { value: AssistantTask; label: string; hint: string }[] = [
  { value: "qa", label: "游戏问答", hint: "例如：什么时候该换人，怎么保护残血主力？" },
  { value: "build", label: "配装建议", hint: "例如：法师金币有限，先补伤害还是续航？" },
  { value: "review", label: "战局复盘", hint: "例如：这波团战输了，下一波该怎么打？" },
];

const qaHints: Record<GameKey, string> = {
  "pokemon-battle-demo": "例如：什么时候该换人，怎么保护残血主力？",
  "moba-postmatch-demo": "例如：什么是 face-check，开龙前该怎么布置视野？",
  "rpg-build-demo": "例如：法师缺蓝又容易倒，先补续航还是生存？",
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
      setError("请先填写局势，或载入样例。");
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
    <main lang="zh-CN" className="gb-page min-h-screen px-5 py-5 md:px-9 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <WorkspaceNav current="assistant" />
        <header className="flex flex-wrap items-end justify-between gap-4 py-7">
          <div>
            <p className="gb-kicker font-mono text-[10px] uppercase tracking-[0.16em] text-ink/65">THE PLAYBOOK / 游戏攻略</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink md:text-4xl">游戏攻略</h1>
          </div>
          <p className="max-w-sm text-xs leading-6 text-ink/65">问打法、看配装、复盘战局。<br />选择游戏，输入你想解决的问题。</p>
        </header>
        <ConnectionStatus />

        <div className="mt-6 grid items-start border border-ink/30 bg-[#f7f6f1] lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
          <form onSubmit={submit} className="min-w-0 border-b border-ink/30 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-ink/30 px-5 py-3">
              <h2 className="text-sm font-bold">提问</h2><span className="font-mono text-[10px] text-ink/65">01 / INPUT</span>
            </div>
            <div className="space-y-5 p-5">
              <label className="block text-xs font-bold">选择游戏
                <select value={game} onChange={(event) => { setGame(event.target.value as GameKey); setStateText("{}"); setError(null); }} className="gb-field mt-2 w-full border border-ink/25 bg-white px-3 py-3 text-sm font-normal">
                  {games.map((item) => <option key={item.value} value={item.value} disabled={task === "build" && item.value !== "rpg-build-demo"}>{item.label}</option>)}
                </select>
                {task === "build" && <span className="mt-2 block text-[11px] font-normal leading-5 text-ink/65">配装支持 RPG，其他游戏可选问答或复盘。</span>}
              </label>
              <fieldset>
                <legend className="text-xs font-bold">选择功能</legend>
                <div className="mt-2 grid grid-cols-3 border border-ink/30">
                  {tasks.map((item, index) => <label key={item.value} className={`cursor-pointer px-2 py-3 text-center text-xs font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-[#f05a32] ${index > 0 ? "border-l border-ink/30" : ""} ${task === item.value ? "bg-ink text-white" : "bg-white hover:bg-[#e5f36a]"}`}>
                    <input type="radio" name="task" value={item.value} checked={task === item.value} onChange={() => { setTask(item.value); setError(null); if (item.value === "build" && game !== "rpg-build-demo") { setGame("rpg-build-demo"); setStateText("{}"); } }} className="sr-only" />{item.label}
                  </label>)}
                </div>
              </fieldset>
              <label className="block text-xs font-bold">写下问题
                <textarea required maxLength={4000} rows={5} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={task === "qa" ? qaHints[game] : tasks.find((item) => item.value === task)?.hint} className="gb-field mt-2 w-full resize-y border border-ink/25 bg-white px-3 py-3 text-sm font-normal leading-6 placeholder:text-ink/65" />
              </label>
              <details open={task !== "qa"} className="border-y border-ink/20">
                <summary className="cursor-pointer py-3 text-xs font-bold">局势数据 <span className="ml-2 font-normal text-ink/65">{task === "qa" ? "可选" : "当前任务必填"} / JSON</span></summary>
                <div className="space-y-3 pb-4">
                  <p className="text-[11px] leading-5 text-ink/65">填写角色、装备、资源与对局信息，也可载入样例修改。</p>
                  <button type="button" onClick={() => { setStateText(samples[game]); setError(null); }} className="border-b border-ink pb-0.5 text-xs font-semibold">载入局势样例 ↗</button>
                  <label className="block font-mono text-[10px] text-ink/65">STATE OBJECT
                    <textarea aria-label="JSON 对象" spellCheck={false} rows={8} value={stateText} onChange={(event) => setStateText(event.target.value)} className="gb-field mt-2 w-full border border-ink/25 bg-white p-3 font-mono text-xs leading-5 text-ink" />
                  </label>
                </div>
              </details>
              <details className="border-b border-ink/20 pb-3">
                <summary className="cursor-pointer text-xs font-bold">玩家档案 <span className="ml-2 font-normal text-ink/65">{privateAccess ? "可选" : "需管理员访问"}</span></summary>
                <label className="mt-3 block text-xs text-ink/65">用户 ID
                  <input disabled={!privateAccess} maxLength={128} value={privateAccess ? userId : ""} onChange={(event) => setUserId(event.target.value)} placeholder={privateAccess ? "例如 player-001" : "需要管理员访问"} className="gb-field mt-2 w-full border border-ink/25 bg-white px-3 py-2.5 text-sm disabled:opacity-50" />
                </label>
              </details>
              {error && <p role="alert" className="border-l-2 border-[#f05a32] bg-[#fce8df] px-3 py-2 text-xs leading-6 text-[#9b3018]">{error}</p>}
              <button disabled={loading} type="submit" className="gb-button flex w-full items-center justify-between border border-ink bg-[#e5f36a] px-4 py-3.5 text-sm font-bold text-ink disabled:cursor-wait disabled:opacity-50"><span>{loading ? "正在分析…" : "获取建议"}</span><span aria-hidden="true">↗</span></button>
            </div>
          </form>

          <section aria-live="polite" aria-busy={loading} className="min-w-0 bg-white">
            <div className="flex items-center justify-between border-b border-ink/30 px-5 py-3">
              <h2 className="text-sm font-bold">建议</h2><span className="font-mono text-[10px] text-ink/65">02 / FIELD NOTES</span>
            </div>
            {!result && <div className="flex min-h-[540px] flex-col p-6 md:p-8">
              <div className="flex items-center gap-4 border-b border-ink/20 pb-4"><GameArt game={game} className="h-16 w-28 shrink-0 border border-ink/20" /><div><p className="font-mono text-[10px] text-ink/65">{gameArtwork[game].english} / {gameArtwork[game].code}</p><p className="mt-2 text-xs font-bold">{games.find((item) => item.value === game)?.label}</p><p className="mt-1 text-[10px] text-ink/65">{tasks.find((item) => item.value === task)?.label}</p></div></div>
              <h3 className="mt-14 max-w-lg text-3xl font-black leading-tight tracking-tight">{loading ? <>正在分析…</> : <>选好游戏，<br />问一个具体问题。</>}</h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-ink/65">{loading ? "正在整理打法与建议。" : task === "qa" ? "例如什么时候换人、开团前做什么，或这件装备该不该换。" : "请填写局势，或载入样例后修改。"}</p>
              {!loading && <div className="mb-2 mt-auto pt-14">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink/65">试着问问 / QUICK QUESTION</p>
                <button type="button" onClick={() => setQuestion(task === "qa" ? qaHints[game].replace("例如：", "") : tasks.find((item) => item.value === task)?.hint.replace("例如：", "") ?? "")} className="flex w-full items-start justify-between gap-5 border-y border-ink/25 py-4 text-left text-sm font-semibold"><span>{task === "qa" ? qaHints[game].replace("例如：", "") : tasks.find((item) => item.value === task)?.hint.replace("例如：", "")}</span><span aria-hidden="true">↗</span></button>
              </div>}
            </div>}
            {result && <>
              <article className="px-6 py-7 md:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 pb-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink/65">{tasks.find((item) => item.value === task)?.label} / RESPONSE</p>
                  {result.evidence_status === "insufficient" && <span className="border border-[#f05a32] px-2 py-1 text-[10px] font-semibold text-[#a7361b]">资料不足</span>}
                </div>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-ink/85">{result.answer}</p>
              </article>
              {result.evidence_status === "insufficient" && <p role="status" className="mx-6 mb-6 border-l-2 border-[#f05a32] pl-4 text-xs leading-6 text-ink/65 md:mx-8">没找到相关攻略。补充角色、装备或战局后再试。</p>}
              {result.sources.length > 0 && <details className="border-t border-ink/30 px-6 py-5 md:px-8">
                <summary className="cursor-pointer text-xs font-bold">参考资料 <span className="ml-2 font-mono text-[10px] font-normal text-ink/65">{result.sources.length} SOURCES</span></summary>
                <ol className="mt-3 divide-y divide-ink/15">
                  {result.sources.map((source, index) => <li key={`${source.path}-${index}`} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 py-4">
                    <span className="pt-0.5 font-mono text-[10px] text-[#d34524]">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0"><p className="break-all font-mono text-[10px] leading-5 text-ink/65">{source.source} / {source.path}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-ink/80">{source.content}</p></div>
                  </li>)}
                </ol>
              </details>}
              <footer className="border-t border-ink/30 px-6 py-5 md:px-8">
                <div className="flex flex-wrap gap-4 text-xs font-bold"><Link href="/review?lang=zh" className="border-b border-ink pb-1">查看战局复盘 ↗</Link>{privateAccess && <Link href={`/ops?trace_id=${encodeURIComponent(result.trace_id)}`} className="border-b border-ink pb-1">保存反馈 ↗</Link>}</div>
                {privateAccess && <p className="mt-4 break-all font-mono text-[10px] text-ink/65">TRACE / {result.trace_id}</p>}
              </footer>
            </>}
          </section>
        </div>
        <SiteFooter />
      </div>
    </main>
  );
}
