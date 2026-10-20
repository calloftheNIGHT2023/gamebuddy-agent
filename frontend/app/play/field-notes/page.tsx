"use client";

import { useEffect, useState } from "react";

import { FieldGame } from "@/components/field-game";
import { WorkspaceNav } from "@/components/workspace-nav";
import { SCENE_ORDER, type SceneKey } from "@/lib/field-game";

export default function FieldNotesPage() {
  const [scene, setScene] = useState<SceneKey>("town");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("scene");
    if (SCENE_ORDER.includes(requested as SceneKey)) setScene(requested as SceneKey);
  }, []);

  function changeScene(next: SceneKey) {
    setScene(next);
    const url = new URL(window.location.href);
    url.searchParams.set("scene", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return <main className="gb-page"><WorkspaceNav current="play" /><FieldGame key={scene} initialScene={scene} onSceneChange={changeScene} /><footer className="fg-credits"><span>GameBuddy / FIELD NOTES</span><span>场景美术 · <a href="https://kenney.nl/assets" target="_blank" rel="noreferrer">Kenney</a> · CC0</span></footer></main>;
}
