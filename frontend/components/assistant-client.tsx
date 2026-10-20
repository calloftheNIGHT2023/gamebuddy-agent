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
    <main lang="zh-CN" className="gb-page min-h-screen px-5 py-5 md:px-9 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <WorkspaceNav current="assistant" />
        <header className="flex flex-wrap items-end justify-between gap-4 py-7">
          <div>
            <p className="gb-kicker font-mono text-[10px] uppercase tracking-[0.16em] text-ink/65">THE PLAYBOOK / 攻略编辑台</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink md:text-4xl">把问题带上桌。</h1>
          </div>
          <p className="max-w-sm text-xs leading-6 text-ink/65">游戏问答、配装取舍与赛后复盘。<br />从已有信息出发，看看下一步怎么打。</p>
        </header>
        <ConnectionStatus />

        <div className="mt-6 grid items-start border border-ink/30 bg-[#f7f6f1] lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
          <form onSubmit={submit} className="min-w-0 border-b border-ink/30 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-ink/30 px-5 py-3">
              <h2 className="text-sm font-bold">你的问题</h2><span className="font-mono text-[10px] text-ink/65">01 / INPUT</span>
            </div>
            <div className="space-y-5 p-5">
              <label className="block text-xs font-bold">选择游戏
                <select value={game} onChange={(event) => { setGame(event.target.value as GameKey); setStateText("{}"); setError(null); }} className="gb-field mt-2 w-full border border-ink/25 bg-white px-3 py-3 text-sm font-normal">
                  {games.map((item) => <option key={item.value} value={item.value} disabled={task === "build" && item.value !== "rpg-build-demo"}>{item.label}</option>)}
                </select>
                {task === "build" && <span className="mt-2 block text-[11px] font-normal leading-5 text-ink/65">养成建议目前支持 RPG；宝可梦、MOBA 可使用问答或复盘。</span>}
              </label>
              <fieldset>
                <legend className="text-xs font-bold">想聊什么</legend>
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
                  <p className="text-[11px] leading-5 text-ink/65">补充角色、装备、资源与对局信息。演示样例可编辑，不代表你的实际局势。</p>
                  <button type="button" onClick={() => { setStateText(samples[game]); setError(null); }} className="border-b border-ink pb-0.5 text-xs font-semibold">载入所选游戏的演示样例 ↗</button>
                  <label className="block font-mono text-[10px] text-ink/65">STATE OBJECT
                    <textarea aria-label="JSON 对象" spellCheck={false} rows={8} value={stateText} onChange={(event) => setStateText(event.target.value)} className="gb-field mt-2 w-full border border-ink/25 bg-white p-3 font-mono text-xs leading-5 text-ink" />
                  </label>
                </div>
              </details>
              <details className="border-b border-ink/20 pb-3">
                <summary className="cursor-pointer text-xs font-bold">个人画像 <span className="ml-2 font-normal text-ink/65">{privateAccess ? "可选" : "公开演示不读取"}</span></summary>
                <label className="mt-3 block text-xs text-ink/65">用户 ID
                  <input disabled={!privateAccess} maxLength={128} value={privateAccess ? userId : ""} onChange={(event) => setUserId(event.target.value)} placeholder={privateAccess ? "例如 player-001" : "需要管理员访问"} className="gb-field mt-2 w-full border border-ink/25 bg-white px-3 py-2.5 text-sm disabled:opacity-50" />
                </label>
              </details>
              {error && <p role="alert" className="border-l-2 border-[#f05a32] bg-[#fce8df] px-3 py-2 text-xs leading-6 text-[#9b3018]">{error}</p>}
              <button disabled={loading} type="submit" className="gb-button flex w-full items-center justify-between border border-ink bg-[#e5f36a] px-4 py-3.5 text-sm font-bold text-ink disabled:cursor-wait disabled:opacity-50"><span>{loading ? "正在翻阅与分析…" : "获取建议"}</span><span aria-hidden="true">↗</span></button>
              <p className="text-[10px] leading-5 text-ink/65">知识库覆盖演示游戏的通用原则，并非完整攻略。具体机制与版本以游戏实际情况为准。</p>
            </div>
          </form>

          <section aria-live="polite" aria-busy={loading} className="min-w-0 bg-white">
            <div className="flex items-center justify-between border-b border-ink/30 px-5 py-3">
              <h2 className="text-sm font-bold">攻略笔记</h2><span className="font-mono text-[10px] text-ink/65">02 / FIELD NOTES</span>
            </div>
            {!result && <div className="flex min-h-[540px] flex-col p-6 md:p-8">
              <div className="flex items-center gap-4 border-b border-ink/20 pb-4"><GameArt game={game} className="h-16 w-28 shrink-0 border border-ink/20" /><div><p className="font-mono text-[10px] text-ink/65">{gameArtwork[game].english} / {gameArtwork[game].code}</p><p className="mt-2 text-xs font-bold">{games.find((item) => item.value === game)?.label}</p><p className="mt-1 text-[10px] text-ink/65">{tasks.find((item) => item.value === task)?.label}</p></div></div>
              <h3 className="mt-14 max-w-lg text-3xl font-black leading-tight tracking-tight">{loading ? <>正在翻页，<br />整理你的下一步。</> : <>没有标准打法，<br />先弄清这一局。</>}</h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-ink/65">{loading ? "完成后将显示建议、知识来源，以及信息中尚未确定的部分。" : task === "qa" ? "选一个游戏，从具体问题开始。局势信息可选，越清楚的描述，越容易讨论到点上。" : "当前任务需要完整局势。填写你的数据，或明确载入演示样例后体验。"}</p>
              {!loading && <div className="mb-2 mt-auto pt-14">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink/65">从这里展开 / A STARTING POINT</p>
                <button type="button" onClick={() => setQuestion(task === "qa" ? qaHints[game].replace("例如：", "") : tasks.find((item) => item.value === task)?.hint.replace("例如：", "") ?? "")} className="flex w-full items-start justify-between gap-5 border-y border-ink/25 py-4 text-left text-sm font-semibold"><span>{task === "qa" ? qaHints[game].replace("例如：", "") : tasks.find((item) => item.value === task)?.hint.replace("例如：", "")}</span><span aria-hidden="true">↗</span></button>
              </div>}
            </div>}
            {result && <>
              <article className="px-6 py-7 md:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 pb-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink/65">{tasks.find((item) => item.value === task)?.label} / RESPONSE</p>
                  <span className={`border px-2 py-1 text-[10px] font-semibold ${result.evidence_status === "grounded" ? "border-ink/25 bg-[#e5f36a] text-ink" : "border-[#f05a32] text-[#a7361b]"}`}>{result.evidence_status === "grounded" ? "有知识来源支持" : "证据不足"}</span>
                </div>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-ink/85">{result.answer}</p>
              </article>
              {result.evidence_status === "insufficient" && <p role="status" className="mx-6 mb-6 border-l-2 border-[#f05a32] pl-4 text-xs leading-6 text-ink/65 md:mx-8">当前知识库未找到足够证据，回答可能只提供一般建议。补充具体角色、装备或对局信息后可再次提问。</p>}
              <section className="border-t border-ink/30 px-6 py-5 md:px-8">
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold">参考来源</h3><span className="font-mono text-[10px] text-ink/65">{String(result.sources.length).padStart(2, "0")} ENTRIES</span></div>
                {result.sources.length === 0 ? <p className="py-4 text-xs text-ink/65">本次没有返回知识来源。</p> : <ol className="mt-3 divide-y divide-ink/15">
                  {result.sources.map((source, index) => <li key={`${source.path}-${index}`} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 py-4">
                    <span className="pt-0.5 font-mono text-[10px] text-[#d34524]">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0"><p className="break-all font-mono text-[10px] leading-5 text-ink/65">{source.source} / {source.path}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-ink/80">{source.content}</p><p className="mt-2 font-mono text-[10px] uppercase text-ink/65">RELEVANCE / {Number.isFinite(source.score) ? source.score.toFixed(3) : "—"}</p></div>
                  </li>)}
                </ol>}
              </section>
              <footer className="border-t border-ink/30 px-6 py-5 md:px-8">
                <div className="flex flex-wrap gap-4 text-xs font-bold"><Link href="/review?lang=zh" className="border-b border-ink pb-1">查看复盘报告 ↗</Link>{privateAccess && <Link href={`/ops?trace_id=${encodeURIComponent(result.trace_id)}`} className="border-b border-ink pb-1">执行与标注 ↗</Link>}</div>
                {privateAccess ? <p className="mt-4 break-all font-mono text-[10px] text-ink/65">TRACE / {result.trace_id}</p> : <p className="mt-4 text-[10px] leading-5 text-ink/65">公开演示不保存个人历史；复盘结果仅在当前标签页临时保留。</p>}
              </footer>
            </>}
          </section>
        </div>
        <SiteFooter />
      </div>
    </main>
  );
}
