// 首页服务端组件，负责读取样例状态并把数据交给客户端主页。
import { readFileSync } from "fs";
import path from "path";

import HomeClient from "@/components/home-client";
import type { GameKey } from "@/lib/types";

export default function Home() {
  // 首页是一个 Server Component。
  // 它在服务端直接把样例 JSON 文件读出来，
  // 然后作为 props 传给客户端组件 HomeClient。
  const samples = {
    "pokemon-battle-demo": readFileSync(path.join(process.cwd(), "..", "samples", "game-states", "balanced-position.json"), "utf-8"),
    "moba-postmatch-demo": readFileSync(path.join(process.cwd(), "..", "samples", "game-states", "moba-comeback-window.json"), "utf-8"),
    "rpg-build-demo": readFileSync(path.join(process.cwd(), "..", "samples", "game-states", "rpg-mage-build.json"), "utf-8"),
  } satisfies Record<GameKey, string>;

  // 默认语言先给英文，客户端里仍然可以再切换。
  return <HomeClient samples={samples} initialLocale="en" />;
}
