import type { Spot, Theme } from "@/domain/types";
import type { Lang } from "@/lib/i18n";
import { localizePlaces } from "./international";

function regionalBlurb(names: string[], lang: Exclude<Lang, "ko">): string {
  const places = new Intl.ListFormat(lang, { style: "long", type: "conjunction" }).format(names);
  return {
    en: `Connect ${places}. Adjust your day around travel times and visiting conditions.`,
    "zh-CN": `串联${places}。请根据交通时间和游览条件调整一日行程。`,
    "zh-TW": `串聯${places}。請依交通時間和遊覽條件調整一日行程。`,
    ja: `${places}を巡ります。移動時間や訪問条件に合わせて一日の旅程を調整しましょう。`,
    de: `Verbinde ${places}. Passe deinen Tagesplan an Fahrzeiten und Besuchsbedingungen an.`,
    fr: `Reliez ${places}. Adaptez votre journée aux temps de trajet et aux conditions de visite.`,
  }[lang];
}

/** 자동 지역 테마의 원래 대표 장소·순서를 유지하며, 확인된 외국어 표시 이름만 덧붙인다. */
export async function localizeRegionalThemes(
  themes: Theme[],
  publicSpots: readonly Spot[],
  lang: Lang,
): Promise<Theme[]> {
  if (lang === "ko" || !themes.length) return themes;
  const regional = themes.filter(
    (theme) => theme.id.startsWith("gangwon-") && !theme.sources?.length,
  );
  if (!regional.length) return themes;
  const ids = new Set(regional.map((theme) => theme.id));
  const members = new Map<string, Spot[]>();
  for (const spot of publicSpots) {
    for (const themeId of spot.themeIds ?? []) {
      if (!ids.has(themeId)) continue;
      const group = members.get(themeId) ?? [];
      group.push(spot);
      members.set(themeId, group);
    }
  }

  const selected = new Map<string, Spot[]>();
  const places = new Map<string, Spot>();
  for (const theme of regional) {
    const names = theme.subtitle.ko.split(" · ");
    if (!names.length || names.length > 3 || names.some((name) => !name.trim())) continue;
    const group = members.get(theme.id) ?? [];
    const ordered: Spot[] = [];
    for (const name of names) {
      const matches = group.filter((spot) => spot.name.ko === name);
      // 같은 테마 안에서도 동명 장소를 임의 선택하지 않는다.
      if (matches.length !== 1) break;
      ordered.push(matches[0]!);
    }
    if (ordered.length !== names.length) continue;
    selected.set(theme.id, ordered);
    for (const place of ordered) places.set(place.id, place);
  }
  if (!places.size) return themes;

  const translated = new Map(
    (await localizePlaces([...places.values()], lang)).map((place) => [place.id, place]),
  );
  return themes.map((theme) => {
    const ordered = selected.get(theme.id);
    if (!ordered) return theme;
    const names = ordered.map((place) => translated.get(place.id)?.name[lang] || place.name.ko);
    return {
      ...theme,
      subtitle: { ...theme.subtitle, [lang]: names.join(" · ") },
      blurb: { ...theme.blurb, [lang]: regionalBlurb(names, lang) },
    };
  });
}
