import { z } from "zod";
import { L } from "@/lib/i18n";
import { THEME_KEYWORD_TOPICS } from "./theme-keywords";
import type { ComposeCourseOptions } from "./course-compose";
import type { OnboardingPreference } from "./types";

const topicDetails: Record<string, { en: string; description: string; query: string }> = {
  sea: { en: "Sea & beaches", description: "해변과 항구, 해안 풍경", query: "바다" },
  mountain: {
    en: "Mountains & hiking",
    description: "산길을 걷고 정상에 오르는 여행",
    query: "트레킹",
  },
  local: { en: "Markets & food", description: "시장과 골목에서 만나는 지역 먹거리", query: "시장" },
  cafe: {
    en: "Cafes & photography",
    description: "커피와 전망, 사진을 남기는 시간",
    query: "카페",
  },
  culture: { en: "Museums & art", description: "미술관과 박물관, 전시와 예술", query: "미술관" },
  heritage: {
    en: "History & temples",
    description: "사찰과 유적, 지역의 오래된 이야기",
    query: "역사",
  },
  forest: { en: "Forests & walks", description: "숲길과 정원에서 천천히 걷기", query: "숲" },
  nature: { en: "Lakes & nature", description: "호수와 계곡, 폭포와 자연 풍경", query: "자연" },
  family: {
    en: "Family activities",
    description: "가족이 함께 즐기는 체험과 나들이",
    query: "가족 체험",
  },
  quiet: {
    en: "Rest & relaxation",
    description: "쉬어 가는 시간을 두는 여행",
    query: "조용한 휴식",
  },
};

/** 실제 코스 ID와 분리된 관심 분야다. 새 지역 코스도 같은 검색 사전을 공유한다. */
export const TRAVEL_INTERESTS = THEME_KEYWORD_TOPICS.map((topic) => ({
  id: `topic:${topic.id}`,
  topicId: topic.id,
  label: L(topic.label, topicDetails[topic.id]!.en),
  description: L(topicDetails[topic.id]!.description),
  query: topicDetails[topic.id]!.query,
}));

export const PACE_LABELS: Record<string, string> = {
  calm: "여유",
  balanced: "균형",
  active: "활동적",
};
export const COMPANION_LABELS: Record<string, string> = {
  solo: "혼자",
  couple: "둘이",
  family: "가족",
};

// catalog-import.ts의 buildRegionalCourses가 생성하는 분류와 일치한다.
// highlights는 종합 코스이므로 특정 관심 분야로 추정하지 않는다.
const REGIONAL_INTEREST_TOPICS: Readonly<Record<string, string>> = {
  sea: "sea",
  forest: "forest",
  nature: "nature",
  culture: "culture",
  heritage: "heritage",
  family: "family",
  local: "local",
};

export const travelPreferenceSchema = z
  .object({
    interestThemeIds: z
      .array(z.string().min(1).max(40))
      .max(TRAVEL_INTERESTS.length)
      .refine((ids) => ids.every((id) => TRAVEL_INTERESTS.some((interest) => interest.id === id)))
      .transform((ids) => [...new Set(ids)]),
    paceId: z.enum(["", "calm", "balanced", "active"]),
    companionId: z.enum(["", "solo", "couple", "family"]),
  })
  .strict();

/** 이전 6개 테마와 지역 코스 ID를 읽을 때만 변환한다. 저장값을 추측해서 만들지 않는다. */
export function normalizeTravelPreference(
  preference: OnboardingPreference | null | undefined,
): OnboardingPreference | null {
  if (!preference) return null;
  const ids = new Set<string>();
  for (const savedId of preference.interestThemeIds) {
    const regionalSuffix = /^gangwon-[a-z]+-([a-z]+)$/.exec(savedId)?.[1];
    const regionalTopic = regionalSuffix ? REGIONAL_INTEREST_TOPICS[regionalSuffix] : undefined;
    for (const topic of THEME_KEYWORD_TOPICS) {
      if (
        savedId === `topic:${topic.id}` ||
        topic.themeIds.some((id) => id === savedId) ||
        regionalTopic === topic.id
      ) {
        ids.add(`topic:${topic.id}`);
      }
    }
  }
  return {
    interestThemeIds: [...ids],
    paceId: Object.hasOwn(PACE_LABELS, preference.paceId) ? preference.paceId : "",
    companionId: Object.hasOwn(COMPANION_LABELS, preference.companionId)
      ? preference.companionId
      : "",
    ...(preference.updatedAt ? { updatedAt: preference.updatedAt } : {}),
  };
}

/** 입력·URL로 지정한 값이 우선이다. 취향은 비워 둔 페이스와 동행에만 사용한다. */
export function applyTravelPreference(
  explicit: ComposeCourseOptions | undefined,
  preference: OnboardingPreference | null | undefined,
): { options: ComposeCourseOptions; labels: string[] } {
  const options = { ...explicit };
  const labels: string[] = [];
  const saved = normalizeTravelPreference(preference);
  if (saved?.paceId && options.pace === undefined) {
    options.pace = saved.paceId;
    labels.push(`${PACE_LABELS[saved.paceId]} 페이스`);
  }
  if (saved?.companionId && options.companion === undefined) {
    options.companion = saved.companionId;
    labels.push(`${COMPANION_LABELS[saved.companionId]} 여행`);
  }
  return { options, labels };
}
