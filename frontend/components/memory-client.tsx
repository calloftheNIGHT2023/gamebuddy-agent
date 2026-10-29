"use client";

import { useEffect, useState } from "react";
import { MemoryPanel } from "@/components/memory-panel";
import { ConnectionStatus } from "@/components/connection-status";
import { SiteFooter, WorkspaceNav } from "@/components/workspace-nav";
import type { UserProfile } from "@/lib/types";
import { getUserProfile } from "@/lib/api";
import { useAdminAccess, useConnectionStatus } from "@/lib/connection";

const empty: UserProfile = { user_id: "", display_name: null, skill_level: null, preferred_style: null, favorite_role: null, favorite_character: null, goals: [], notes: [] };

export function MemoryClient() {
  const [profile, setProfile] = useState<UserProfile>(empty);
  const [sessionId, setSessionId] = useState("");
  const [ready, setReady] = useState(false);
  const { health } = useConnectionStatus();
  const { hasToken, revision } = useAdminAccess();
  const privateAccess = health?.mode === "local" || hasToken;
  useEffect(() => {
    let next = { ...empty };
    try {
      const stored = JSON.parse(window.localStorage.getItem("gamebuddy:user-profile") || "null") as UserProfile | null;
      if (stored && typeof stored === "object") next = { ...empty, ...stored,
        goals: Array.isArray(stored.goals) ? stored.goals.filter((item) => typeof item === "string") : [],
        notes: Array.isArray(stored.notes) ? stored.notes.filter((item) => typeof item === "string") : [] };
      if (!next.user_id) next.user_id = `player-${crypto.randomUUID().slice(0, 8)}`;
      let session = window.localStorage.getItem("gamebuddy:session-id");
      if (!session) { session = crypto.randomUUID(); window.localStorage.setItem("gamebuddy:session-id", session); }
      setSessionId(session);
    } catch { next = { ...empty }; }
    setProfile(next); setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !privateAccess || !profile.user_id.trim()) return;
    let active = true;
    const userId = profile.user_id;
    getUserProfile(userId).then((saved) => { if (active && saved) setProfile(saved); }).catch(() => { /* Manual load shows connection errors in the profile panel. */ });
    return () => { active = false; };
  }, [ready, privateAccess, profile.user_id, revision]);
  useEffect(() => {
    if (ready) { try { window.localStorage.setItem("gamebuddy:user-profile", JSON.stringify(profile)); } catch { /* The server remains available without browser storage. */ } }
  }, [profile, ready]);
  return <main className="gb-page"><WorkspaceNav current="memory" /><header className="py-8"><p className="gb-kicker text-ember">THE PLAYER FILE</p><h1 className="mt-3 text-4xl font-black">玩家记忆</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/65">常玩什么、正在练什么、上次哪里没打好，都放在这里。相关记录会在下一次分析时带出来。</p><p className="mt-2 text-xs leading-6 text-ink/65">也可以在游戏助手里说“记住：我主玩辅助”或“记住：回答简短一点”。</p></header><ConnectionStatus /><div className="mt-6">{ready && <MemoryPanel locale="zh" profile={profile} sessionId={sessionId} onProfileChange={setProfile} />}</div><SiteFooter /></main>;
}
