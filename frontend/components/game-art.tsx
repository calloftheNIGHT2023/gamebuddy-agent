import Image from "next/image";
import type { GameKey } from "@/lib/types";

export const gameArtwork: Record<GameKey, { image: string; alt: string; label: string; english: string; code: string }> = {
  "pokemon-battle-demo": { image: "/images/pixel-overworld.png", alt: "松风镇的村庄、林间小路与城门", label: "回合策略", english: "TURN-BASED", code: "01" },
  "moba-postmatch-demo": { image: "/images/pixel-tactics.png", alt: "河谷争夺的河道、桥梁与战场", label: "战术复盘", english: "TACTICS", code: "02" },
  "rpg-build-demo": { image: "/images/pixel-dungeon.png", alt: "地牢余火的石墙、守卫与地下房间", label: "角色养成", english: "ROLE-PLAYING", code: "03" },
};

export function GameArt({ game, className = "", priority = false }: { game: GameKey; className?: string; priority?: boolean }) {
  const art = gameArtwork[game];
  return <div className={`gb-art ${className}`}><Image src={art.image} alt={art.alt} width={918} height={515} priority={priority} sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 700px" className="gb-art-image" /></div>;
}
