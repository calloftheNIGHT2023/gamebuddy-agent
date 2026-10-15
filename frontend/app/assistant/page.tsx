import { readFileSync } from "fs";
import path from "path";

import { AssistantClient } from "@/components/assistant-client";
import type { GameKey } from "@/lib/types";

export default function AssistantPage() {
  const samples = {
    "pokemon-battle-demo": readFileSync(path.join(process.cwd(), "..", "samples", "game-states", "balanced-position.json"), "utf-8"),
    "moba-postmatch-demo": readFileSync(path.join(process.cwd(), "..", "samples", "game-states", "moba-comeback-window.json"), "utf-8"),
    "rpg-build-demo": readFileSync(path.join(process.cwd(), "..", "samples", "game-states", "rpg-mage-build.json"), "utf-8"),
  } satisfies Record<GameKey, string>;
  return <AssistantClient samples={samples} />;
}
