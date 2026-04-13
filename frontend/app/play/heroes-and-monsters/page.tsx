import { ValorGame } from "@/components/valor-game";
import type { Locale } from "@/lib/types";

type Props = {
  searchParams?: {
    lang?: string;
  };
};

export default function HeroesAndMonstersPage({ searchParams }: Props) {
  const locale: Locale = searchParams?.lang === "zh" ? "zh" : "en";
  return <ValorGame initialLocale={locale} />;
}
