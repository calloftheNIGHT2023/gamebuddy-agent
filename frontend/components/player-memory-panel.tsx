"use client";

import { useEffect, useRef, useState } from "react";
import { editPlayerMemory, forgetPlayerMemory, getPlayerMemories, savePlayerMemory } from "@/lib/api";
import { useAdminAccess } from "@/lib/connection";
import type { MemoryGame, PlayerMemory } from "@/lib/types";

export const memoryGames: { id: MemoryGame; label: string }[] = [
  { id: "town", label: "松风镇" }, { id: "river", label: "河谷争夺" }, { id: "dungeon", label: "地牢余火" },
  { id: "pokemon-battle-demo", label: "宝可梦对战" }, { id: "moba-postmatch-demo", label: "MOBA" }, { id: "rpg-build-demo", label: "RPG 配装" },
];
const kinds = { note: "个人提醒", lesson: "复盘经验", goal: "当前目标", episode: "对局记录" };

export function PlayerMemoryPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<PlayerMemory[]>([]);
  const [content, setContent] = useState("");
  const [game, setGame] = useState<MemoryGame | "">("");
  const [kind, setKind] = useState<PlayerMemory["kind"]>("lesson");
  const [ttl, setTtl] = useState("");
  const [editing, setEditing] = useState<PlayerMemory | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const epoch = useRef(0);
  const { revision } = useAdminAccess();

  useEffect(() => {
    const run = ++epoch.current;
    setItems([]); setError(null); setLoading(Boolean(userId));
    if (userId) getPlayerMemories(userId).then((result) => { if (run === epoch.current) setItems(result); })
      .catch((cause) => { if (run === epoch.current) setError(cause instanceof Error ? cause.message : "读取失败，请重试。"); })
      .finally(() => { if (run === epoch.current) setLoading(false); });
    return () => { epoch.current += 1; };
  }, [userId, revision, refresh]);

  function reset() { setEditing(null); setContent(""); setTtl(""); }
  function edit(item: PlayerMemory) {
    setEditing(item); setContent(item.content); setGame(item.game ?? ""); setKind(item.kind);
    setTtl(item.expires_at ? String(Math.max(1, Math.ceil((Date.parse(item.expires_at) - Date.now()) / 86400000))) : "");
    setMessage(null); setError(null);
  }
  async function save() {
    if (!userId || !content.trim()) { setError("先填写玩家 ID 和要记住的内容。"); return; }
    const run = epoch.current;
    setBusy(true); setError(null); setMessage(null);
    try {
      const existingGoal = kind === "goal" ? items.find((item) => item.game === (game || null) && item.kind === "goal" && item.key === "current_goal") : null;
      if (editing) await editPlayerMemory(editing, content.trim(), ttl ? Number(ttl) : null);
      else await savePlayerMemory({ user_id: userId, game: game || null, kind, content: content.trim(), ttl_days: ttl ? Number(ttl) : null,
        key: kind === "goal" ? "current_goal" : `note-${crypto.randomUUID()}`, expected_revision: existingGoal?.revision ?? 0 });
      if (run === epoch.current) { reset(); setMessage("记下了，下次分析相关局势时会用到。"); setRefresh((value) => value + 1); }
    } catch (cause) { if (run === epoch.current) setError(cause instanceof Error ? cause.message : "保存失败。"); }
    finally { if (run === epoch.current) setBusy(false); }
  }
  async function forget(item: PlayerMemory) {
    const run = epoch.current;
    setBusy(true); setError(null); setMessage(null);
    try {
      await forgetPlayerMemory(item);
      if (run === epoch.current) { if (editing?.id === item.id) reset(); setMessage("已删除这条记忆。"); setRefresh((value) => value + 1); }
    } catch (cause) { if (run === epoch.current) setError(cause instanceof Error ? cause.message : "删除失败。"); }
    finally { if (run === epoch.current) setBusy(false); }
  }

  return <section className="mt-7 border-t border-ink/25 pt-6" aria-label="长期记忆">
    <div className="flex items-center justify-between gap-3"><div><p className="gb-kicker">PLAYER NOTES</p><h4 className="mt-2 text-xl font-bold">留到下一局</h4></div><button type="button" disabled={loading || busy} onClick={() => setRefresh((value) => value + 1)} className="text-xs underline underline-offset-4">刷新</button></div>
    <p className="mt-3 text-xs leading-6 text-ink/65">写下常忘的事、复盘经验或练习目标。可按游戏保存，也可以设定到期时间。</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-xs">用于哪个游戏<select aria-label="记忆适用游戏" disabled={busy || Boolean(editing)} value={game} onChange={(event) => setGame(event.target.value as MemoryGame | "")} className="gb-field mt-2 w-full"><option value="">所有游戏</option>{memoryGames.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-xs">记忆类型<select disabled={busy || Boolean(editing)} value={kind} onChange={(event) => setKind(event.target.value as PlayerMemory["kind"])} className="gb-field mt-2 w-full">{Object.entries(kinds).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="text-xs">保留多久<input type="number" min={1} max={365} disabled={busy} value={ttl} onChange={(event) => setTtl(event.target.value)} placeholder="留空则长期保留（天）" className="gb-field mt-2 w-full" /></label>
    </div>
    <label className="mt-4 block text-xs">{editing ? "修改这条记忆" : "要记住什么"}<textarea aria-label="记忆内容" disabled={busy} maxLength={300} rows={3} value={content} onChange={(event) => setContent(event.target.value)} placeholder="例如：下地牢前先留一瓶药水；练习在开龙前提前回城。" className="gb-field mt-2 w-full" /></label>
    <div className="mt-3 flex gap-4"><button type="button" disabled={busy || loading || !userId} onClick={() => void save()} className="gb-button border-ink bg-ink px-4 py-2.5 text-xs text-white disabled:opacity-50">{busy ? "处理中…" : editing ? "保存修改" : "记住这件事"}</button>{editing && <button disabled={busy} type="button" onClick={reset} className="text-xs underline">取消修改</button>}</div>
    {error && <p role="alert" className="mt-3 text-sm text-[#a53924]">{error}</p>}{message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <div className="mt-5 divide-y divide-ink/20 border-y border-ink/20">
      {loading ? <p className="py-5 text-sm">正在读取记忆…</p> : items.length === 0 ? <p className="py-5 text-sm text-ink/65">{userId ? "还没有记下的内容。" : "填写玩家 ID 后查看。"}</p> : items.map((item) => <article key={item.id} className="py-4">
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-ink/65"><span>{memoryGames.find((game) => game.id === item.game)?.label ?? "所有游戏"} / {kinds[item.kind]}</span><span>第 {item.revision} 版 · {item.source === "game" ? "来自游戏复盘" : item.source === "explicit_request" ? "来自你的提问" : "手动保存"}</span></div>
        <p className="my-3 whitespace-pre-wrap break-words text-sm leading-7">{item.content}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs"><span className="text-ink/65">{item.expires_at ? `${new Date(item.expires_at).toLocaleDateString()} 到期` : "长期保留"}</span><span className="flex gap-4"><button type="button" disabled={busy} onClick={() => edit(item)} className="underline underline-offset-4">修改</button><button type="button" disabled={busy} onClick={() => void forget(item)} className="text-[#a53924] underline underline-offset-4">删除</button></span></div>
      </article>)}
    </div>
  </section>;
}
