import { GANGWON_REGIONS } from "./place-search";

interface MatchableTheme {
  id: string;
  title: string;
  subtitle?: string;
  region?: string;
}
/** 명시한 지역은 일반 무드 키워드보다 우선한다. LLM 대역과 결정형 폴백이 같은 기준을 쓴다. */
export function regionalThemeMatch(query: string, themes: MatchableTheme[]): string | undefined {
  const region = GANGWON_REGIONS.find((r) => query.includes(r.ko));
  if (!region) return undefined;
  const topics: [string, RegExp][] = [
    ["culture", /전시|미술|박물관|예술/],
    ["heritage", /역사|사찰|유적|절\s/],
    ["sea", /바다|해변|항구|일출/],
    ["forest", /숲|정원|힐링|산책|휴양림/],
    ["nature", /계곡|폭포|동굴|호수|지질/],
    ["local", /시장|먹거리|미식|골목/],
    ["family", /체험|가족|아이/],
  ];
  const topic = topics.find(([, pattern]) => pattern.test(query))?.[0];
  return themes
    .filter((t) => t.id.startsWith(`gangwon-${region.key}-`))
    .map((t) => ({
      id: t.id,
      score:
        (topic && t.id.endsWith(`-${topic}`) ? 100 : 0) +
        (t.id.endsWith("-highlights") ? 1 : 0) +
        query
          .split(/\s+/)
          .filter((w) => w.length >= 2 && `${t.title} ${t.subtitle ?? ""}`.includes(w)).length,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0]?.id;
}
