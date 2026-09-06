import { createHash } from "node:crypto";
import { requireEnv } from "@/lib/env";
import { apiCache } from "@/server/cache";
import { haversineKm } from "@/domain/travel-time";
import { checkedTourismPlaceAliases } from "@/domain/tourism-place-aliases";
import type {
  MediaCollection,
  SpotMediaQuery,
  SpotTourismMedia,
  TourismAudioGuide,
  TourismMediaLanguage,
  TourismPhoto,
} from "@/domain/tourism-media";
import { callDataGoKr } from "./http";
import { cleanTourText } from "./tourapi";

const PHOTO_BASE = "https://apis.data.go.kr/B551011/PhotoGalleryService1";
const AUDIO_BASE = "https://apis.data.go.kr/B551011/Odii";
const COMMON = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json", numOfRows: 100, pageNo: 1 };
const CACHE_TTL = 24 * 60 * 60_000;
const FAILURE_TTL = 5 * 60_000;
const failedUntil = new Map<string, number>();

/** 공식 Odii 명세의 언어만 요청하며, 다른 언어를 사용자 언어로 가장하지 않는다. */
export const ODII_LANGUAGE: Partial<Record<TourismMediaLanguage, string>> = {
  ko: "ko",
  en: "en",
  "zh-CN": "cn1",
  ja: "jp",
};

export interface RawTourismPhoto {
  galContentId?: string;
  galTitle?: string;
  galWebImageUrl?: string;
  galPhotographyLocation?: string;
  galPhotographer?: string;
  galPhotographyMonth?: string;
  galUseFlag?: string;
}
export interface RawTourismAudio {
  tid?: string;
  tlid?: string;
  stid?: string;
  stlid?: string;
  title?: string;
  mapX?: string;
  mapY?: string;
  audioTitle?: string;
  script?: string;
  playTime?: string;
  audioUrl?: string;
  langCode?: string;
}
interface Envelope<T> {
  response?: { header?: { resultCode?: string }; body?: { items?: { item?: T | T[] } | "" } };
}
function rows<T>(data: Envelope<T>): T[] {
  const items = data.response?.body?.items;
  const item = items && items.item;
  return item ? (Array.isArray(item) ? item : [item]) : [];
}
function text(value: string | undefined): string {
  return cleanTourText(value?.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ""));
}
function httpsUrl(value: string | undefined): string | undefined {
  try {
    const url = new URL(value?.trim() || "");
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function photoUrl(value: string | undefined): string | undefined {
  const secure = httpsUrl(value);
  if (secure) return secure;
  try {
    const url = new URL(value || "");
    // 기존 Next 이미지 프록시가 허용한 관광공사 HTTP 사진은 프록시로만 표시한다.
    return url.protocol === "http:" &&
      url.hostname === "tong.visitkorea.or.kr" &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
function compact(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}
function withoutRegion(value: string, region: string): string {
  let normalized = text(value).normalize("NFKC").trim();
  for (const prefix of ["강원특별자치도", "강원도", `${region}시`, `${region}군`, region]) {
    if (prefix && normalized.startsWith(`${prefix} `))
      normalized = normalized.slice(prefix.length).trim();
  }
  return normalized;
}
function mediaPlaceName(query: SpotMediaQuery): string {
  return checkedTourismPlaceAliases({ ...query, lon: query.lng })[0] ?? query.nameKo;
}
function matchingName(candidate: string, query: SpotMediaQuery): boolean {
  const place = withoutRegion(mediaPlaceName(query), query.regionKo)
    .replace(/\s*[([][^)\]]*[)\]]\s*/g, " ")
    .trim();
  const name = withoutRegion(candidate, query.regionKo);
  if (!place || compact(place).length < 2) return false;
  return (
    compact(name) === compact(place) ||
    (name.startsWith(place) && /^[\s]*[([]/.test(name.slice(place.length)))
  );
}
function nearPlace(row: RawTourismAudio, query: SpotMediaQuery): boolean {
  const lat = Number(row.mapY);
  const lng = Number(row.mapX);
  if (!row.mapX?.trim() || !row.mapY?.trim() || !validCoordinate(lat, lng)) return false;
  return haversineKm({ lat, lon: lng }, { lat: query.lat, lon: query.lng }) <= 0.5;
}
function validCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 33 &&
    lat <= 39.5 &&
    lng >= 124 &&
    lng <= 132
  );
}

/** 사진은 관광 contentId/좌표가 없어 촬영지의 강원 시군과 장소명을 모두 확인한다. */
export function normalizeTourismPhotos(
  raw: RawTourismPhoto[],
  query: SpotMediaQuery,
): TourismPhoto[] {
  const seen = new Set<string>();
  return raw
    .flatMap((row) => {
      const location = text(row.galPhotographyLocation);
      const region = query.regionKo.replace(/[시군]$/, "");
      const imageUrl = photoUrl(row.galWebImageUrl);
      if (
        !row.galContentId ||
        !imageUrl ||
        row.galUseFlag === "N" ||
        !region ||
        !/^(?:강원특별자치도|강원도|강원)\s/.test(location) ||
        !location
          .split(/\s+/)
          .some((part) => [region, `${region}시`, `${region}군`].includes(part)) ||
        !matchingName(text(row.galTitle), query) ||
        seen.has(imageUrl)
      )
        return [];
      seen.add(imageUrl);
      const month = row.galPhotographyMonth?.trim();
      return [
        {
          id: row.galContentId,
          title: text(row.galTitle),
          imageUrl,
          location,
          photographer: text(row.galPhotographer) || undefined,
          photographedMonth:
            month && /^\d{4}(0[1-9]|1[0-2])$/.test(month)
              ? `${month.slice(0, 4)}-${month.slice(4)}`
              : undefined,
          sourceName: "한국관광공사 포토코리아",
          sourceUrl: "https://phoko.visitkorea.or.kr/",
          license: {
            code: "KOGL-1" as const,
            name: "공공누리 제1유형 (출처표시)",
            url: "https://www.data.go.kr/data/15101914/openapi.do",
          },
        },
      ];
    })
    .slice(0, 6);
}

/** 한국어 이름+500m 이내 좌표로 확인한 이야기 ID만 다른 언어에 연결한다. */
function matchedStoryIds(koreanRows: RawTourismAudio[], query: SpotMediaQuery): Set<string> {
  return new Set(
    koreanRows
      .filter(
        (row) =>
          row.langCode === "ko" &&
          row.tid &&
          row.stid &&
          matchingName(text(row.title), query) &&
          nearPlace(row, query),
      )
      .map((row) => `${row.tid}:${row.stid}`),
  );
}

export function normalizeTourismAudio(
  koreanRows: RawTourismAudio[],
  localizedRows: RawTourismAudio[],
  query: SpotMediaQuery,
  language: TourismMediaLanguage,
): TourismAudioGuide[] {
  const langCode = ODII_LANGUAGE[language];
  if (!langCode) return [];
  const matched = matchedStoryIds(koreanRows, query);
  const seen = new Set<string>();
  return localizedRows
    .flatMap((row) => {
      if (
        !row.stid ||
        !row.stlid ||
        row.langCode !== langCode ||
        !matched.has(`${row.tid}:${row.stid}`) ||
        !nearPlace(row, query) ||
        seen.has(row.stlid)
      )
        return [];
      const transcript = text(row.script);
      const audioUrl = httpsUrl(row.audioUrl);
      if (!audioUrl && !transcript) return [];
      const duration = Number(row.playTime);
      seen.add(row.stlid);
      return [
        {
          id: row.stlid,
          storyId: row.stid,
          title: text(row.audioTitle) || text(row.title),
          placeName: text(row.title),
          language,
          durationSeconds:
            row.playTime?.trim() && Number.isFinite(duration) && duration > 0 && duration < 86400
              ? Math.round(duration)
              : undefined,
          audioUrl,
          transcript: transcript || undefined,
          sourceName: "한국관광공사 오디",
          sourceUrl: "https://www.odii.kr/",
        },
      ];
    })
    .slice(0, 8);
}

async function cachedRows<T>(
  source: "photo" | "audio",
  base: string,
  operation: string,
  params: Record<string, string | number>,
): Promise<T[]> {
  const key = createHash("sha256")
    .update(JSON.stringify([operation, params]))
    .digest("hex")
    .slice(0, 24);
  return apiCache.cached(`tourism-media:v1:${source}:${key}`, CACHE_TTL, async () => {
    if ((failedUntil.get(source) || 0) > Date.now()) throw new Error("관광 미디어 재조회 대기");
    try {
      const data = await callDataGoKr<Envelope<T>>(
        `${base}/${operation}`,
        { ...COMMON, ...params },
        { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
      );
      if (!data.response?.body) throw new Error("관광 미디어 응답 형식 오류");
      return rows(data);
    } catch (error) {
      failedUntil.set(source, Date.now() + FAILURE_TTL);
      throw error;
    }
  });
}
async function photos(query: SpotMediaQuery): Promise<MediaCollection<TourismPhoto>> {
  try {
    const raw = await cachedRows<RawTourismPhoto>("photo", PHOTO_BASE, "gallerySearchList1", {
      keyword: mediaPlaceName(query),
      arrange: "A",
    });
    const items = normalizeTourismPhotos(raw, query);
    return { status: items.length ? "available" : "empty", items };
  } catch {
    return { status: "unavailable", items: [] };
  }
}
async function audio(
  query: SpotMediaQuery,
  language: TourismMediaLanguage,
): Promise<MediaCollection<TourismAudioGuide>> {
  if (!ODII_LANGUAGE[language]) return { status: "unsupported", items: [] };
  if (!validCoordinate(query.lat, query.lng)) return { status: "empty", items: [] };
  const params = { mapX: query.lng, mapY: query.lat, radius: 1000 };
  try {
    const korean = await cachedRows<RawTourismAudio>(
      "audio",
      AUDIO_BASE,
      "storyLocationBasedList",
      { ...params, langCode: "ko" },
    );
    if (!matchedStoryIds(korean, query).size) return { status: "empty", items: [] };
    const translated =
      language === "ko"
        ? korean
        : await cachedRows<RawTourismAudio>("audio", AUDIO_BASE, "storyLocationBasedList", {
            ...params,
            langCode: ODII_LANGUAGE[language]!,
          });
    const items = normalizeTourismAudio(korean, translated, query, language);
    return { status: items.length ? "available" : "empty", items };
  } catch {
    return { status: "unavailable", items: [] };
  }
}

export async function getSpotTourismMedia(
  query: SpotMediaQuery,
  language: TourismMediaLanguage = "ko",
): Promise<SpotTourismMedia> {
  const [photoResult, audioResult] = await Promise.all([photos(query), audio(query, language)]);
  return { requestedLanguage: language, photos: photoResult, audio: audioResult };
}
