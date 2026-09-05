import { inferCourseOptions } from "./course-options";
import type { Theme } from "./types";

/** 요청에서 받은 seed만 사용한다. 렌더 중의 Math.random이나 DB 추천 순서에 의존하지 않는다. */
function randomFromSeed(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function validThemes(themes: readonly Theme[]) {
  const seen = new Set<string>();
  return themes.filter((theme) => {
    if (
      !theme.id ||
      !Number.isFinite(theme.spotCount) ||
      theme.spotCount <= 0 ||
      seen.has(theme.id)
    )
      return false;
    seen.add(theme.id);
    return true;
  });
}

const days = (theme: Theme) => inferCourseOptions(theme.duration.ko).days ?? 0;
const regions = (theme: Theme) => theme.region.ko.split(/\s*[·,]\s*/).filter(Boolean);
function quality(theme: Theme) {
  const count = days(theme);
  if (!count || count > theme.spotCount) return 2;
  return theme.sources?.length ? 0 : 1;
}

/** 같은 기간에서는 구성 근거가 있는 코스를 우선하고, 가능한 한 이웃 카드의 권역을 바꾼다. */
function createSelector(pool: Theme[]) {
  const metadata = new Map(
    pool.map((theme) => [
      theme.id,
      {
        duration: days(theme),
        quality: quality(theme),
        regions: regions(theme),
      },
    ]),
  );
  const frequency = new Map<string, number>();
  let previous = new Set<string>();
  return (wanted: readonly number[]): Theme | undefined => {
    if (!pool.length) return undefined;
    let candidates: Theme[] = [];
    for (const duration of wanted) {
      candidates = pool.filter((theme) => metadata.get(theme.id)!.duration === duration);
      if (candidates.length) break;
    }
    if (!candidates.length) candidates = pool;
    const bestQuality = Math.min(...candidates.map((theme) => metadata.get(theme.id)!.quality));
    const score = (theme: Theme) => {
      const keys = metadata.get(theme.id)!.regions;
      const repeated = keys.some((key) => previous.has(key)) ? 1000 : 0;
      return repeated + keys.reduce((sum, key) => sum + (frequency.get(key) ?? 0), 0) * 10;
    };
    // 동점은 이미 섞인 순서를 유지한다.
    let chosen: Theme | undefined;
    let bestScore = Infinity;
    for (const candidate of candidates) {
      if (metadata.get(candidate.id)!.quality !== bestQuality) continue;
      const candidateScore = score(candidate);
      if (candidateScore < bestScore) {
        chosen = candidate;
        bestScore = candidateScore;
      }
    }
    if (!chosen) return undefined;
    pool.splice(pool.indexOf(chosen), 1);
    previous = new Set(metadata.get(chosen.id)!.regions);
    for (const region of previous) frequency.set(region, (frequency.get(region) ?? 0) + 1);
    return chosen;
  };
}

/** 첫 화면의 숙박 여행 비율만 바꾼다. 전체 카탈로그와 필터 후보는 삭제하지 않는다. */
export function orderDiscoverThemes(themes: readonly Theme[], seed: string): Theme[] {
  const pool = shuffled(validThemes(themes), randomFromSeed(`discover:${seed}`));
  const result: Theme[] = [];
  const takeTheme = createSelector(pool);
  const firstPage = [2, 3, 1, 2, 3, 2, 1, 2, 4, 2, 1, 3, 2, 5, 1, 2, 3, 2];
  const remaining = [2, 3, 1, 2, 1, 4, 1, 3, 1, 5];
  while (pool.length) {
    const desired =
      result.length < firstPage.length
        ? firstPage[result.length]!
        : remaining[(result.length - firstPage.length) % remaining.length]!;
    const theme = takeTheme([desired, 2, 3, 4, 5, 1, 0]);
    if (theme) result.push(theme);
  }
  return result;
}

/** 1박·2박을 기본으로, 일부 방문에서 긴 여행을 한 장 보여 준다. */
export function selectHomeThemes(themes: readonly Theme[], seed: string): Theme[] {
  const random = randomFromSeed(`home:${seed}`);
  const valid = validThemes(themes);
  const photographed = valid.filter((theme) => theme.imageUrl);
  const pool = shuffled(photographed.length >= 3 ? photographed : valid, random);
  const third = random() < 0.25 ? (random() < 0.5 ? 4 : 5) : 2;
  const result: Theme[] = [];
  const takeTheme = createSelector(pool);
  for (const duration of [2, 3, third]) {
    const theme = takeTheme([duration, 2, 3, 4, 5, 1, 0]);
    if (theme) result.push(theme);
  }
  return result;
}
