import { readFileSync } from "fs";
import path from "path";

import HomeClient from "@/components/home-client";
import type { GameKey, Locale } from "@/lib/types";

type Props = {
  searchParams?: {
    lang?: string;
  };
};

export default function Home({ searchParams }: Props) {
  const samples = {
    "pokemon-battle-demo": readFileSync(
      path.join(process.cwd(), "..", "samples", "game-states", "balanced-position.json"),
      "utf-8"
    ),
    "moba-postmatch-demo": readFileSync(
      path.join(process.cwd(), "..", "samples", "game-states", "moba-comeback-window.json"),
      "utf-8"
    ),
    "rpg-build-demo": readFileSync(
      path.join(process.cwd(), "..", "samples", "game-states", "rpg-mage-build.json"),
      "utf-8"
    ),
  } satisfies Record<GameKey, string>;

  const initialLocale: Locale = searchParams?.lang === "zh" ? "zh" : "en";

  return <HomeClient samples={samples} initialLocale={initialLocale} />;
}
