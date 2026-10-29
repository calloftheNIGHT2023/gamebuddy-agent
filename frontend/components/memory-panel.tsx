"use client";

// 记忆面板，用于读写用户画像并展示近期分析历史。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { getAnalysisHistory, getUserProfile, saveUserProfile } from "@/lib/api";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";
import type { AnalysisHistoryItem, Locale, UserProfile } from "@/lib/types";
import { PlayerMemoryPanel } from "@/components/player-memory-panel";

type Props = {
  locale: Locale;
  profile: UserProfile;
  sessionId: string;
  onProfileChange: (profile: UserProfile) => void;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function MemoryPanel({ locale, profile, sessionId, onProfileChange }: Props) {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [onlySession, setOnlySession] = useState(false);
  const { health, error: connectionError } = useConnectionStatus();
  const { hasToken, revision } = useAdminAccess();
  const privateAccess = health?.mode === "local" || hasToken;
  const currentOwner = useRef(profile.user_id);
  const currentAccess = useRef(privateAccess);
  currentOwner.current = profile.user_id;
  currentAccess.current = privateAccess;

  useEffect(() => {
    setHistoryError(null);
    if (!profile.user_id || !privateAccess) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    let active = true;
    setHistory([]);
    setLoadingHistory(true);
    getAnalysisHistory({ userId: profile.user_id, sessionId: onlySession ? sessionId : undefined, limit: 6 })
      .then((items) => {
        if (active) {
          setHistory(items);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setHistoryError(error instanceof Error ? error.message : "历史读取失败，请重试。");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });

    return () => {
      active = false;
    };
  }, [profile.user_id, sessionId, onlySession, privateAccess, revision, retry]);

  async function handleSaveProfile() {
    if (!profile.user_id) {
      setMessage(locale === "zh" ? "请先填写 User ID。" : "Add a user id first.");
      return;
    }

    setSavingProfile(true);
    setMessage(null);
    const owner = profile.user_id;
    try {
      const saved = await saveUserProfile(profile);
      if (currentOwner.current !== owner || !currentAccess.current) return;
      onProfileChange(saved);
      setMessage(locale === "zh" ? "档案已保存。" : "Profile saved.");
    } catch (error) {
      if (currentOwner.current === owner) setMessage(error instanceof Error ? error.message : locale === "zh" ? "保存档案失败。" : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLoadProfile() {
    if (!profile.user_id) {
      setMessage(locale === "zh" ? "请先填写 User ID。" : "Add a user id first.");
      return;
    }

    setMessage(null);
    const owner = profile.user_id;
    try {
      const loaded = await getUserProfile(profile.user_id);
      if (currentOwner.current !== owner || !currentAccess.current) return;
      if (!loaded) {
        setMessage(locale === "zh" ? "还没有这个玩家的档案。" : "No saved profile found.");
        return;
      }
      onProfileChange({
        ...loaded,
        goals: loaded.goals ?? [],
        notes: loaded.notes ?? [],
      });
      setMessage(locale === "zh" ? "档案已载入。" : "Profile loaded.");
    } catch (error) {
      if (currentOwner.current === owner) setMessage(error instanceof Error ? error.message : locale === "zh" ? "载入档案失败。" : "Failed to load profile.");
    }
  }

  if (!privateAccess) {
    return <section className="gb-panel p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-ink/20 pb-3"><p className="gb-kicker">{locale === "zh" ? "玩家档案" : "Player file"}</p><span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65">PRIVATE</span></div>
      <h3 className="mt-5 text-xl font-semibold">{locale === "zh" ? "玩家档案与历史" : "Profile and history"}</h3>
      <p className="mt-3 text-sm leading-7 text-ink/65">{connectionError ? (locale === "zh" ? "服务尚未连接，请重试连接。" : "The service is disconnected. Try reconnecting.") : health?.mode === "public" ? (locale === "zh" ? "玩家档案和历史记录需管理员访问。" : "Player profiles and history require administrator access.") : (locale === "zh" ? "连接服务后可读取档案与历史。" : "Connect the service to read profiles and history.")}</p>
      <Link href="/ops" className="gb-button mt-5 inline-flex items-center gap-5 border-ink bg-ink px-4 py-3 text-sm font-semibold text-white">{locale === "zh" ? "管理员访问" : "Administrator access"}<span aria-hidden="true">↗</span></Link>
    </section>;
  }

  return (
    <section className="gb-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/20 pb-5">
        <div>
          <p className="gb-kicker">{locale === "zh" ? "玩家档案" : "Player file"}</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">
            {locale === "zh" ? "玩家档案与历史" : "Profile and history"}
          </h3>
        </div>
        <div className="max-w-full border-l-2 border-ember pl-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/65">SESSION</p><p className="mt-1 break-all font-mono text-[10px] text-ink/65">{sessionId}</p></div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">User ID</span>
          <input
            value={profile.user_id}
            disabled={savingProfile}
            onChange={(event) => onProfileChange({ user_id: event.target.value, display_name: null, skill_level: null, preferred_style: null, favorite_role: null, favorite_character: null, goals: [], notes: [] })}
            className="gb-field w-full"
          />
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "显示名称" : "Display name"}</span>
          <input
            value={profile.display_name ?? ""}
            onChange={(event) => onProfileChange({ ...profile, display_name: event.target.value || null })}
            className="gb-field w-full"
          />
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "水平" : "Skill level"}</span>
          <select
            value={profile.skill_level ?? ""}
            onChange={(event) =>
              onProfileChange({ ...profile, skill_level: (event.target.value || null) as UserProfile["skill_level"] })
            }
            className="gb-field w-full"
          >
            <option value="">未设置</option><option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "回复风格" : "Response style"}</span>
          <select
            value={profile.preferred_style ?? ""}
            onChange={(event) =>
              onProfileChange({ ...profile, preferred_style: (event.target.value || null) as UserProfile["preferred_style"] })
            }
            className="gb-field w-full"
          >
            <option value="">未设置</option><option value="concise">concise</option>
            <option value="balanced">balanced</option>
            <option value="detailed">detailed</option>
          </select>
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "常玩定位" : "Favorite role"}</span>
          <input
            value={profile.favorite_role ?? ""}
            onChange={(event) => onProfileChange({ ...profile, favorite_role: event.target.value || null })}
            className="gb-field w-full"
          />
        </label>
        <label className="text-sm text-ink/75">
          <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "常用角色" : "Favorite character"}</span>
          <input
            value={profile.favorite_character ?? ""}
            onChange={(event) => onProfileChange({ ...profile, favorite_character: event.target.value || null })}
            className="gb-field w-full"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-ink/75">
        <span className="mb-2 block font-medium text-ink">{locale === "zh" ? "目标" : "Goals"}</span>
        <input
          value={profile.goals.join(", ")}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              goals: event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
          className="gb-field w-full"
        />
      </label>

      <label className="mt-4 block text-sm"><span className="mb-2 block font-medium">{locale === "zh" ? "个人提醒（每行一条）" : "Personal notes (one per line)"}</span><textarea rows={3} maxLength={3000} value={profile.notes.join("\n")} onChange={(event) => onProfileChange({ ...profile, notes: event.target.value.split("\n").map((text) => text.trim()).filter(Boolean).slice(0, 10) })} className="gb-field w-full" /></label>
      <div className="mt-5 flex flex-wrap gap-3 border-t border-ink/20 pt-5">
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="gb-button border-ink bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {savingProfile ? (locale === "zh" ? "保存中..." : "Saving...") : locale === "zh" ? "保存档案" : "Save profile"}
        </button>
        <button
          type="button"
          onClick={handleLoadProfile}
          className="gb-button border-ink bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-gold/30"
        >
          {locale === "zh" ? "载入档案" : "Load profile"}
        </button>
      </div>

      {message ? <p role="status" className="mt-3 border-l-2 border-ember pl-3 text-sm leading-7 text-ink/70">{message}</p> : null}
      <PlayerMemoryPanel key={profile.user_id} userId={profile.user_id} />

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 border-y border-ink bg-mist px-3 py-3">
          <h4 className="text-sm font-semibold text-ink">{locale === "zh" ? "最近战局" : "Recent history"}</h4>
          <label className="text-xs"><input type="checkbox" checked={onlySession} onChange={(event) => setOnlySession(event.target.checked)} className="mr-2" />{locale === "zh" ? "只看本次会话" : "This session only"}</label>
          {loadingHistory ? <span className="text-xs text-ink/65">{locale === "zh" ? "加载中..." : "Loading..."}</span> : null}
        </div>
        <div className="divide-y divide-ink/20">
          {historyError ? (
            <div className="border-l-2 border-red-700 bg-red-50 p-4 text-sm leading-7 text-red-800"><p role="alert">{historyError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 font-semibold underline underline-offset-4">{locale === "zh" ? "重试读取历史" : "Retry history"}</button></div>
          ) : loadingHistory ? (
            <p className="p-4 text-sm text-ink/65">{locale === "zh" ? "正在读取历史…" : "Loading history…"}</p>
          ) : history.length === 0 ? (
            <div className="border-b border-dashed border-ink/25 px-3 py-6 text-sm leading-7 text-ink/65">
              {profile.user_id ? locale === "zh" ? "还没有战局记录。" : "No history available yet." : locale === "zh" ? "填写 User ID 后读取对应历史。" : "Enter a User ID to load history."}
            </div>
          ) : (
            history.map((item) => (
              <article key={`${item.created_at}-${item.question}`} className="px-3 py-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{item.question}</p>
                  <span className="font-mono text-[10px] text-ink/65">{formatTimestamp(item.created_at)}</span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/70">{item.response.summary}</p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ember">{item.game}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
