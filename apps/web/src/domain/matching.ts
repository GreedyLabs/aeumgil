import { L } from "@/lib/i18n";
import { GANGWON_REGIONS } from "./place-search";
import { inferCourseOptions } from "./course-options";
import { THEME_EXTRA_KEYWORDS, THEME_KEYWORD_TOPICS } from "./theme-keywords";
import type { KeywordRule, Theme, ThemeMatch } from "./types";

export const INTENT_QUERY_MAX_LENGTH = 200;

/** 화면의 원문을 유지하면서 제어문자·중복 공백만 정리한다. */
export function normalizeIntentQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\s]+/g, " ")
    .trim();
}

interface Occurrence {
  word: string;
  start: number;
  end: number;
  negative: boolean;
}
const wordPattern = /[\p{L}\p{N}]+/gu;
const koreanEndings =
  /^(?:(?:에서|으로|이랑|하고|이지만|이라도|이나|이든|은|는|이|가|을|를|와|과|도|만|에|로|의|랑|나)?(?:여행|나들이|구경|코스|투어|탐방|산책|보러|보기|타고|말고|말구|제외|빼고|한|하게|하고|해서|하며|했던|하는|하기|고|러|으러|는|으면서|을|면서|어요|싶어|고싶어|로운|롭게|있게|게|한곳|한거|거|것)?(?:을|를|이|가|은|는|도|만|에|에서|으로|로|랑|하고)?)$/;
const negativeAfter =
  /^(?:은|는|이|가|을|를|와|과|도|만|에|에서|으로|로|랑)?\s*(?:(?:건|것은|것도|것)\s*)?(?:말고|말구|아닌|아니고|제외|빼고|싫|별로|피하|피할|원하지|안\s*(?:가|보|하)|가지\s*않|가고\s*싶지\s*않)/;
const negativeBefore = /(?:^|\s)(?:no|not|without|avoid)\s*$/i;
const genericWords = new Set([
  "여행",
  "하루",
  "당일",
  "코스",
  "추천",
  "대표",
  "명소",
  "곳",
  "함께",
  "즐기는",
  "강원",
  "강원도",
  "강원특별자치도",
  "싶어",
  "싶어요",
  "하고",
  "있는",
  "찾기",
  "나들이",
  "tour",
  "trip",
  "travel",
  "day",
]);

/** 명시한 어휘 뒤에 조사·활용형만 허용한다. '계산/부산/산책'의 '산'은 히트하지 않는다. */
function wordMatches(word: string, keyword: string): boolean {
  if (word === keyword) return true;
  if (!word.startsWith(keyword)) return false;
  const ending = word.slice(keyword.length);
  return /^[가-힣]+$/.test(keyword) ? koreanEndings.test(ending) : /^(?:s|es|ing)$/.test(ending);
}

function occurrences(query: string, keyword: string): Occurrence[] {
  const q = query.toLowerCase();
  const key = keyword.normalize("NFKC").toLowerCase();
  const out: Occurrence[] = [];
  for (const match of q.matchAll(wordPattern)) {
    const fullWord = match[0];
    let word = fullWord;
    let offset = match.index;
    // '강릉바다여행'처럼 붙인 지역+목적도 사전에 있는 단어로만 분리한다.
    const prefix = GANGWON_REGIONS.find((r) => word.startsWith(r.ko) && word.length > r.ko.length);
    if (!wordMatches(word, key) && prefix && wordMatches(word.slice(prefix.ko.length), key)) {
      word = word.slice(prefix.ko.length);
      offset += prefix.ko.length;
    }
    if (!wordMatches(word, key)) continue;
    const end = offset + key.length;
    out.push({
      word: key,
      start: offset,
      end,
      negative:
        negativeAfter.test(q.slice(end)) ||
        negativeBefore.test(q.slice(Math.max(0, offset - 16), offset)),
    });
  }
  return out;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** 기존 규칙 호출부도 부정·단어 경계를 동일하게 적용한다. */
export function matchThemeIdsByKeyword(query: string, rules: KeywordRule[]): string[] {
  const q = normalizeIntentQuery(query);
  const excluded = new Set(
    rules
      .filter((r) => r.keywords.some((k) => occurrences(q, k).some((o) => o.negative)))
      .map((r) => r.themeId),
  );
  return unique(
    rules
      .filter(
        (r) =>
          !excluded.has(r.themeId) &&
          r.keywords.some((k) => occurrences(q, k).some((o) => !o.negative)),
      )
      .map((r) => r.themeId),
  );
}

/** 호환용 단일 규칙 매칭. 관련 없는 테마로 빈자리를 채우지 않는다. */
export function matchThemes(
  query: string,
  rules: KeywordRule[],
  themeIds: string[],
  maxAlts = 2,
): ThemeMatch {
  const matched = matchThemeIdsByKeyword(query, rules).filter((id) => themeIds.includes(id));
  return { primaryId: matched[0] ?? "", altIds: matched.slice(1, 1 + Math.max(0, maxAlts)) };
}

export interface MatchableTheme {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
  region?: string;
  mood?: string[];
  keywords?: string[];
  days?: number;
}

export function matchingTheme(theme: Theme): MatchableTheme {
  return {
    id: theme.id,
    title: `${theme.title.ko} ${theme.title.en}`,
    subtitle: `${theme.subtitle.ko} ${theme.subtitle.en}`,
    tag: `${theme.tag.ko} ${theme.tag.en}`,
    region: theme.region.ko,
    mood: theme.mood.flatMap((m) => [m.ko, m.en]),
    days: inferCourseOptions(theme.duration.ko).days,
  };
}

function themeRegions(theme: MatchableTheme): string[] {
  return GANGWON_REGIONS.filter(
    (r) =>
      theme.id.startsWith(`gangwon-${r.key}-`) ||
      occurrences(theme.region ?? "", r.ko).length > 0 ||
      occurrences(theme.title, r.ko).length > 0,
  ).map((r) => r.ko);
}

/** 지역 표기 없는 경우도 전체 테마의 제목·태그·무드·추가 키워드를 사용한다. */
function themeTopics(theme: MatchableTheme): Set<string> {
  const metadata = [
    theme.title,
    theme.subtitle,
    theme.tag,
    ...(theme.mood ?? []),
    ...(theme.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const regionalTopic = /^gangwon-[a-z]+-([a-z]+)$/.exec(theme.id)?.[1];
  return new Set(
    THEME_KEYWORD_TOPICS.filter(
      (topic) =>
        topic.themeIds.some((id) => id === theme.id) ||
        regionalTopic === topic.id ||
        (topic.id === "quiet" && regionalTopic === "forest") ||
        // 분류가 명시된 지역 코스는 포괄적인 소개 문구로 다른 성격을 덧씌우지 않는다.
        (!regionalTopic &&
          topic.metadata.some((keyword) => occurrences(metadata, keyword).length > 0)),
    ).map((topic) => topic.id),
  );
}

function directThemeKeywords(theme: MatchableTheme): string[] {
  return unique([
    ...(THEME_EXTRA_KEYWORDS[theme.id] ?? []),
    ...(theme.keywords ?? []),
    ...Array.from(
      `${theme.title} ${theme.tag ?? ""} ${(theme.mood ?? []).join(" ")}`
        .toLowerCase()
        .matchAll(wordPattern),
      (m) => m[0],
    ),
  ]).filter(
    (word) =>
      word.length >= 2 &&
      !genericWords.has(word) &&
      !GANGWON_REGIONS.some((r) => r.ko === word || r.en.toLowerCase() === word),
  );
}

/**
 * DB 테마에 붙은 분류 사전 + 명시적 단어 점수로 매칭한다. LLM·날씨·혼잡 API 호출은 없다.
 * 지역은 필터, 제외한 성격은 탈락 조건이다. 긍정 단어가 없으면 성공을 꾸며내지 않는다.
 */
export function rankCatalogThemes(
  raw: string,
  themes: MatchableTheme[],
  maxAlts = 2,
  preference: { preferredTopicIds?: readonly string[] } = {},
): ThemeMatch {
  const query = normalizeIntentQuery(raw).slice(0, INTENT_QUERY_MAX_LENGTH).toLowerCase();
  const requestedDays = inferCourseOptions(query).days;
  const topicHits = THEME_KEYWORD_TOPICS.map((topic) => ({
    topic,
    hits: topic.keywords.flatMap((keyword) => occurrences(query, keyword)),
  }));
  const excludedTopics = new Set<string>(
    topicHits.filter((t) => t.hits.some((h) => h.negative)).map((t) => t.topic.id),
  );
  const positiveTopics = topicHits.filter(
    (t) => !excludedTopics.has(t.topic.id) && t.hits.some((h) => !h.negative),
  );
  const regionHits = GANGWON_REGIONS.map((region) => ({
    region,
    hits: [region.ko, region.en, `${region.ko}시`, `${region.ko}군`].flatMap((k) =>
      occurrences(query, k),
    ),
  }));
  // 지역+목적 붙여 쓰기는 목적 어휘를 확인한 경우만 지역으로 읽는다.
  for (const item of regionHits) {
    if (item.hits.length) continue;
    const words = Array.from(query.matchAll(wordPattern));
    const found = words.find(
      (m) =>
        m[0].startsWith(item.region.ko) &&
        topicHits.some((t) => t.hits.some((h) => h.start === m.index + item.region.ko.length)),
    );
    if (found)
      item.hits.push({
        word: item.region.ko,
        start: found.index,
        end: found.index + item.region.ko.length,
        negative: false,
      });
  }
  const regions = regionHits
    .filter((r) => r.hits.some((h) => !h.negative) && !r.hits.some((h) => h.negative))
    .map((r) => r.region.ko);
  const excludedRegions = regionHits
    .filter((r) => r.hits.some((h) => h.negative))
    .map((r) => r.region.ko);
  const excludedKeywords = unique([
    ...topicHits.flatMap((t) => t.hits.filter((h) => h.negative).map((h) => h.word)),
    ...excludedRegions,
  ]);
  const requested = (keywords: string[]) =>
    keywords.some((word) => occurrences(query, word).some((hit) => !hit.negative));
  const needsAccessibility = requested([
    "무장애",
    "휠체어",
    "유모차",
    "계단",
    "장애인",
    "wheelchair",
    "accessible",
  ]);
  const needsPetInfo = requested([
    "반려견",
    "반려동물",
    "강아지",
    "애견",
    "반려견동반",
    "pet",
    "dog",
  ]);
  const needsIndoorInfo =
    positiveTopics.some((t) => t.topic.id === "culture") &&
    requested(["실내", "비오는날", "비오는", "indoor", "rainy"]);
  const ranked = themes
    .map((theme) => {
      const ownRegions = themeRegions(theme);
      const ownTopics = themeTopics(theme);
      if (
        (regions.length && !ownRegions.some((r) => regions.includes(r))) ||
        ownRegions.some((r) => excludedRegions.includes(r)) ||
        [...ownTopics].some((id) => excludedTopics.has(id))
      )
        return null;
      const hits = positiveTopics.filter((t) => ownTopics.has(t.topic.id));
      const direct = directThemeKeywords(theme).flatMap((keyword) => occurrences(query, keyword));
      if (direct.some((h) => h.negative)) return null;
      const words = unique([
        ...hits.flatMap((t) => t.hits.filter((h) => !h.negative).map((h) => h.word)),
        ...direct.filter((h) => !h.negative).map((h) => h.word),
      ]);
      if (!regions.length && !words.length) return null;
      const score =
        hits.reduce((sum, t) => sum + t.topic.weight, 0) +
        Math.min(3, direct.length) +
        (regions.length ? 30 : 0) +
        (requestedDays && theme.days === requestedDays ? 6 : 0);
      const preferredTopics = (preference.preferredTopicIds ?? []).filter((id) =>
        ownTopics.has(id),
      );
      const fallbackPriority = theme.id.endsWith("-highlights") && !positiveTopics.length ? 2 : 0;
      return { theme, score, words, topicCount: hits.length, preferredTopics, fallbackPriority };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    // 관심 분야는 명시적 단어 점수가 같은 후보 사이에서만 보조 기준으로 사용한다.
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.preferredTopics.length - a.preferredTopics.length ||
        b.fallbackPriority - a.fallbackPriority ||
        a.theme.id.localeCompare(b.theme.id),
    );
  const best = ranked[0];
  if (!best || (!positiveTopics.length && !regions.length && !best.words.length)) {
    return {
      primaryId: "",
      altIds: [],
      explanation: {
        status: "unmatched",
        keywords: [],
        excludedKeywords,
        regions,
        summary: L(
          query
            ? "입력한 조건과 연결되는 테마를 찾지 못했어요."
            : "여행할 지역이나 하고 싶은 활동을 알려 주세요.",
          "No theme matches these words yet.",
        ),
        notice: L(
          needsAccessibility
            ? "무장애 조건은 여행지 찾기의 ‘무장애 안내’ 필터와 장소 상세에서 확인해 주세요."
            : needsPetInfo
              ? "반려동물 동반 가능 여부는 장소별 운영 안내를 확인해 주세요. 지역이나 활동도 함께 입력하면 테마를 찾을 수 있어요."
              : "예: ‘양구에서 미술관’, ‘강릉 바다와 카페’, ‘바다 말고 숲 산책’처럼 지역이나 활동을 적어 주세요.",
          "Try a Gangwon town and an activity, such as museums in Yanggu or a forest walk.",
        ),
      },
    };
  }
  const missing = positiveTopics.filter((t) => !themeTopics(best.theme).has(t.topic.id));
  const status =
    missing.length || needsAccessibility || needsPetInfo || needsIndoorInfo ? "partial" : "matched";
  const criteria = [...regions, ...best.words].slice(0, 6);
  const notes: string[] = [];
  if (missing.length)
    notes.push(
      `${unique(missing.map((t) => t.topic.label)).join("·")} 조건은 이 테마에 모두 포함되지 않을 수 있어요.`,
    );
  if (positiveTopics.some((t) => t.topic.id === "quiet"))
    notes.push("조용한 분위기의 테마를 찾은 결과이며 실제 혼잡도는 방문 시각에 따라 달라요.");
  if (needsIndoorInfo)
    notes.push(
      "실내 운영 여부와 휴관일은 각 장소 상세에서 확인해 주세요. 문화 테마에 야외 장소가 포함될 수 있어요.",
    );
  if (needsAccessibility)
    notes.push("휠체어·유모차 이용 가능 여부는 여행지별 무장애 안내를 확인해 주세요.");
  if (needsPetInfo)
    notes.push(
      "반려동물 동반 가능 여부는 이 추천에서 확인하지 않았어요. 방문 전 장소별 운영 안내를 확인해 주세요.",
    );
  if (regions.length > 1)
    notes.push("여러 지역의 후보를 비교한 결과예요. 한 코스에 모든 지역이 포함되는 것은 아니에요.");
  return {
    primaryId: best.theme.id,
    // 지역만 맞고 목적 단어가 전혀 없는 후보는 일치 후보가 있을 때 대안에 섞지 않는다.
    altIds: ranked
      .slice(1)
      .filter((r) => !best.words.length || r.words.length > 0)
      .slice(0, Math.max(0, maxAlts))
      .map((r) => r.theme.id),
    explanation: {
      status,
      keywords: best.words.slice(0, 8),
      excludedKeywords,
      regions,
      ...(best.preferredTopics.length &&
      ranked.some(
        (item) =>
          item.score === best.score && item.preferredTopics.length < best.preferredTopics.length,
      )
        ? {
            preference: L(
              "입력 조건이 같은 후보에서는 저장한 관심 분야를 참고했어요.",
              "Your saved interests helped order equally matching candidates.",
            ),
          }
        : {}),
      summary: L(
        `${criteria.map((word) => `‘${word}’`).join(" · ")} 단어를 바탕으로 찾은 테마예요.`,
        `Selected using these words: ${criteria.join(", ")}.`,
      ),
      ...(notes.length
        ? {
            notice: L(
              notes.join(" "),
              "Some requested conditions need to be checked in the course and place details.",
            ),
          }
        : {}),
    },
  };
}
