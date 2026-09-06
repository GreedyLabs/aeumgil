import { env } from "@/lib/env";
import { haversineKm } from "@/domain/travel-time";
import { apiCache } from "../cache";
import { callDataGoKr } from "./http";

export const INTERNATIONAL_TOUR_SERVICES = {
  en: "EngService2",
  "zh-CN": "ChsService2",
  "zh-TW": "ChtService2",
  ja: "JpnService2",
  de: "GerService2",
  fr: "FreService2",
} as const;
export type InternationalLanguage = keyof typeof INTERNATIONAL_TOUR_SERVICES;

const TTL = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
const MAX_PAGES = 20;
const MATCH_DISTANCE_METERS = 300;
const COMMON = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json" };
const CACHE_PREFIX = "tourapi:international:v1";

type RawItem = Record<string, unknown>;
export interface InternationalSpotIdentity {
  id: string;
  sourceContentId?: string;
  name: { ko: string; en?: string };
  lat?: number;
  lon?: number;
  region?: string;
  /** 검토를 마친 동일 시설의 이름만 전달한다. 부분 일치·자동 번역은 사용하지 않는다. */
  nameAliases?: readonly string[];
}
export interface InternationalTourItem {
  language: InternationalLanguage;
  contentId: string;
  contentTypeId: string;
  title: string;
  address: string;
  lat: number;
  lon: number;
  regionCode: string;
  sigunguCode: string;
  modifiedAt?: string;
}
export type InternationalCatalog =
  | {
      status: "available";
      language: InternationalLanguage;
      items: InternationalTourItem[];
      /** API 원문 전체 건수. 좌표나 이름이 불완전한 항목은 items에서 제외된다. */
      total: number;
      complete: true;
      retrievedAt: string;
    }
  | {
      status: "unavailable";
      language: InternationalLanguage;
      items: InternationalTourItem[];
      total: 0;
      complete: false;
      reason: "not-configured" | "api-error" | "incomplete";
    };
export type InternationalSpotMatch =
  | {
      status: "matched";
      item: InternationalTourItem;
      distanceMeters: number;
      method: "coordinates-and-name";
    }
  | { status: "unmatched" | "ambiguous" };
export interface InternationalVisitInfo {
  address?: string;
  hours?: string;
  closed?: string;
  fees?: string;
  parking?: string;
  phone?: string;
}
export interface InternationalTourProvenance {
  provider: "한국관광공사";
  service: string;
  endpoint: string;
  originalContentId?: string;
  foreignContentId: string;
  matchedBy: "coordinates-and-name";
  distanceMeters: number;
  retrievedAt: string;
  modifiedAt?: string;
}
export type InternationalTourInfo =
  | {
      status: "available";
      language: InternationalLanguage;
      officialLanguage: InternationalLanguage;
      contentId: string;
      title: string;
      address: string;
      overview?: string;
      visitInfo: InternationalVisitInfo;
      homepage?: string;
      provenance: InternationalTourProvenance;
      unavailableSections: ("overview" | "visitInfo")[];
    }
  | {
      status: "unavailable";
      language: InternationalLanguage;
      reason: "not-configured" | "api-error" | "incomplete" | "not-provided" | "ambiguous";
    };

function base(language: InternationalLanguage): string {
  return `https://apis.data.go.kr/B551011/${INTERNATIONAL_TOUR_SERVICES[language]}`;
}
function record(value: unknown): RawItem | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawItem)
    : undefined;
}
function rawString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function cleanText(value: unknown): string {
  const entities: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    ldquo: "“",
    rdquo: "”",
    lsquo: "‘",
    rsquo: "’",
    ndash: "–",
    mdash: "—",
  };
  return rawString(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
      if (key.startsWith("#")) {
        const code =
          key[1]?.toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
        return Number.isInteger(code) &&
          code > 0 &&
          code <= 0x10ffff &&
          !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code)
          : "";
      }
      return entities[key.toLowerCase()] ?? entity;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
function hasForeignText(value: string, language: InternationalLanguage): boolean {
  return language === "zh-CN" || language === "zh-TW" || language === "ja"
    ? /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)
    : /\p{Script=Latin}/u.test(value);
}
function coord(value: unknown): number {
  const text = rawString(value).trim();
  return text ? Number(text) : NaN;
}
function hasCoord(spot: { lat?: number; lon?: number }): spot is { lat: number; lon: number } {
  return (
    typeof spot.lat === "number" &&
    Number.isFinite(spot.lat) &&
    spot.lat >= 33 &&
    spot.lat <= 39 &&
    typeof spot.lon === "number" &&
    Number.isFinite(spot.lon) &&
    spot.lon >= 124 &&
    spot.lon <= 132
  );
}
export function normalizeInternationalTourItem(
  raw: RawItem,
  language: InternationalLanguage,
): InternationalTourItem | null {
  const title = cleanText(raw.title);
  const lat = coord(raw.mapy),
    lon = coord(raw.mapx);
  const regionCode = rawString(raw.lDongRegnCd);
  if (
    !/^\d+$/.test(rawString(raw.contentid)) ||
    !/^\d+$/.test(rawString(raw.contenttypeid)) ||
    !title ||
    !hasForeignText(title, language) ||
    !hasCoord({ lat, lon }) ||
    (regionCode ? regionCode !== "51" : rawString(raw.areacode) !== "32")
  )
    return null;
  return {
    language,
    contentId: rawString(raw.contentid),
    contentTypeId: rawString(raw.contenttypeid),
    title,
    address: [cleanText(raw.addr1), cleanText(raw.addr2)].filter(Boolean).join(" "),
    lat,
    lon,
    regionCode: "51",
    sigunguCode: rawString(raw.lDongSignguCd),
    modifiedAt: rawString(raw.modifiedtime) || undefined,
  };
}
function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
function titleNames(value: string): string[] {
  const text = value.normalize("NFKC");
  const values = [text];
  const starts: number[] = [];
  let outside = "";
  for (let i = 0; i < text.length; i++) {
    const character = text[i]!;
    if (character === "(") starts.push(i);
    else if (character === ")" && starts.length) {
      const start = starts.pop()!;
      values.push(text.slice(start + 1, i));
    } else if (starts.length === 0) outside += character;
  }
  if (outside.trim()) values.push(outside);
  return [...new Set(values.map(normalizeName).filter(Boolean))];
}
function identityNames(spot: InternationalSpotIdentity): Set<string> {
  const values = [spot.name.ko, ...(spot.nameAliases ?? [])];
  if (spot.name.en && spot.name.en !== spot.name.ko) values.push(spot.name.en);
  if (spot.region) {
    for (const value of [...values]) {
      const [first, ...rest] = value.trim().split(/\s+/);
      if (first === spot.region || first === `${spot.region}시` || first === `${spot.region}군`) {
        if (rest.length) values.push(rest.join(" "));
      }
    }
  }
  return new Set(values.map(normalizeName).filter(Boolean));
}

/** 언어별 콘텐츠 ID는 서로 다르다. 300m 이내 좌표와 완전한 이름이 함께 맞는 단일 후보만 연결한다. */
export function matchInternationalSpot(
  spot: InternationalSpotIdentity,
  items: readonly InternationalTourItem[],
): InternationalSpotMatch {
  if (!hasCoord(spot)) return { status: "unmatched" };
  const names = identityNames(spot);
  const matches = new Map<string, { item: InternationalTourItem; distanceMeters: number }>();
  for (const item of items) {
    if (!hasCoord(item)) continue;
    const distanceMeters = haversineKm(spot, item) * 1000;
    if (
      distanceMeters > MATCH_DISTANCE_METERS ||
      !titleNames(item.title).some((name) => names.has(name))
    )
      continue;
    matches.set(`${item.language}:${item.contentId}`, { item, distanceMeters });
  }
  if (matches.size !== 1) return { status: matches.size ? "ambiguous" : "unmatched" };
  const match = matches.values().next().value!;
  return {
    status: "matched",
    ...match,
    distanceMeters: Math.round(match.distanceMeters),
    method: "coordinates-and-name",
  };
}

class IncompleteCatalogError extends Error {}
function readPage(data: unknown): { total: number; rows: RawItem[] } {
  const envelope = record(data),
    response = record(envelope?.response);
  const header = record(response?.header),
    body = record(response?.body);
  // 일부 파라미터 오류는 response.header 대신 최상위 resultCode로 온다.
  if (envelope?.resultCode !== undefined && !/^0+$/.test(rawString(envelope.resultCode)))
    throw new Error("관광 API 오류 응답");
  if (!header || !/^0+$/.test(rawString(header.resultCode)) || !body)
    throw new Error("관광 API 응답 형식 오류");
  const total = Number(body.totalCount);
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    body.totalCount === undefined ||
    body.totalCount === null
  )
    throw new Error("관광 API 전체 건수 오류");
  const rawItems = record(body.items)?.item;
  const values = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  const rows = values.map(record);
  if (rows.some((row) => !row)) throw new Error("관광 API 항목 형식 오류");
  if ((total === 0 && rows.length) || (total > 0 && !rows.length))
    throw new IncompleteCatalogError("관광 API 목록 누락");
  return { total, rows: rows as RawItem[] };
}
async function request(
  language: InternationalLanguage,
  operation: string,
  params: Record<string, string | number>,
  serviceKey: string,
) {
  return readPage(
    await callDataGoKr(`${base(language)}/${operation}`, { ...COMMON, ...params }, { serviceKey }),
  );
}

/** 검색/카드 모두 같은 언어의 강원 전체 목록을 공유한다. 목록에서 상세 API를 개별 호출하지 않는다. */
export async function getInternationalCatalog(
  language: InternationalLanguage,
): Promise<InternationalCatalog> {
  const serviceKey = env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey)
    return {
      status: "unavailable",
      language,
      items: [],
      total: 0,
      complete: false,
      reason: "not-configured",
    };
  try {
    return await apiCache.cached(`${CACHE_PREFIX}:${language}:catalog`, TTL, async () => {
      const rows: RawItem[] = [],
        ids = new Set<string>();
      let total: number | undefined;
      for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
        const page = await request(
          language,
          "areaBasedList2",
          { lDongRegnCd: 51, arrange: "A", numOfRows: PAGE_SIZE, pageNo },
          serviceKey,
        );
        if (page.total > MAX_PAGES * PAGE_SIZE || (total !== undefined && page.total !== total))
          throw new IncompleteCatalogError("관광 API 목록 범위 변경");
        total = page.total;
        for (const row of page.rows) {
          const id = rawString(row.contentid);
          if (!/^\d+$/.test(id) || ids.has(id))
            throw new IncompleteCatalogError("관광 API 목록 중복/식별자 누락");
          ids.add(id);
          rows.push(row);
        }
        if (rows.length === total) {
          return {
            status: "available" as const,
            language,
            complete: true as const,
            total,
            items: rows
              .map((row) => normalizeInternationalTourItem(row, language))
              .filter((item): item is InternationalTourItem => item !== null),
            retrievedAt: new Date().toISOString(),
          };
        }
        if (rows.length > total || page.rows.length !== PAGE_SIZE)
          throw new IncompleteCatalogError("관광 API 목록 페이지 누락");
      }
      throw new IncompleteCatalogError("관광 API 목록 상한 초과");
    });
  } catch (error) {
    return {
      status: "unavailable",
      language,
      items: [],
      total: 0,
      complete: false,
      reason: error instanceof IncompleteCatalogError ? "incomplete" : "api-error",
    };
  }
}
function visitInfo(
  raw: RawItem,
  address: string,
  language: InternationalLanguage,
): InternationalVisitInfo {
  const first = (...keys: string[]) =>
    keys
      .map((key) => cleanText(raw[key]))
      .find(
        (value) =>
          Boolean(value) && (!/\p{Script=Hangul}/u.test(value) || hasForeignText(value, language)),
      );
  return {
    address: address || undefined,
    hours: first("usetime", "usetimeculture", "usetimeleports", "opentimefood", "opentime"),
    closed: first(
      "restdate",
      "restdateculture",
      "restdateleports",
      "restdatefood",
      "restdateshopping",
    ),
    fees: first("usefee", "usefeeleports"),
    parking: first("parking", "parkingculture", "parkingleports", "parkingfood", "parkingshopping"),
    phone: first(
      "infocenter",
      "infocenterculture",
      "infocenterleports",
      "infocenterfood",
      "infocentershopping",
    ),
  };
}
function safeHomepage(raw: unknown): string | undefined {
  const value = rawString(raw);
  const candidate = /href\s*=\s*["']([^"']+)["']/i.exec(value)?.[1] ?? value.trim();
  try {
    const url = new URL(candidate.replace(/&amp;/g, "&"));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** 국문 콘텐츠 ID를 외국어 서비스로 직접 보내지 않고 검증한 별도 ID의 상세만 조회한다. */
export async function getInternationalTourInfo(
  spot: InternationalSpotIdentity,
  language: InternationalLanguage,
): Promise<InternationalTourInfo> {
  const catalog = await getInternationalCatalog(language);
  if (catalog.status !== "available")
    return { status: "unavailable", language, reason: catalog.reason };
  const match = matchInternationalSpot(spot, catalog.items);
  if (match.status !== "matched")
    return {
      status: "unavailable",
      language,
      reason: match.status === "ambiguous" ? "ambiguous" : "not-provided",
    };
  const serviceKey = env.DATA_GO_KR_SERVICE_KEY!;
  const { item } = match;
  const [common, intro] = await Promise.allSettled([
    apiCache.cached(`${CACHE_PREFIX}:${language}:common:${item.contentId}`, TTL, async () => {
      // detailCommon2에 contentTypeId를 보내면 HTTP 200 안의 resultCode=10으로 거절된다.
      const page = await request(
        language,
        "detailCommon2",
        { contentId: item.contentId, numOfRows: 1, pageNo: 1 },
        serviceKey,
      );
      const row = page.rows[0];
      if (page.total !== 1 || !row || rawString(row.contentid) !== item.contentId)
        throw new Error("외국어 상세 정보 미제공");
      return { row, retrievedAt: new Date().toISOString() };
    }),
    apiCache.cached(
      `${CACHE_PREFIX}:${language}:intro:${item.contentId}:${item.contentTypeId}`,
      TTL,
      async () => {
        const page = await request(
          language,
          "detailIntro2",
          { contentId: item.contentId, contentTypeId: item.contentTypeId, numOfRows: 1, pageNo: 1 },
          serviceKey,
        );
        const row = page.rows[0];
        if (page.total !== 1 || !row || rawString(row.contentid) !== item.contentId)
          throw new Error("외국어 이용 안내 미제공");
        return row;
      },
    ),
  ]);
  if (common.status !== "fulfilled")
    return { status: "unavailable", language, reason: "api-error" };
  const detail = normalizeInternationalTourItem(common.value.row, language);
  if (!detail || matchInternationalSpot(spot, [detail]).status !== "matched")
    return { status: "unavailable", language, reason: "not-provided" };
  const rawOverview = cleanText(common.value.row.overview);
  const overview = rawOverview && hasForeignText(rawOverview, language) ? rawOverview : undefined;
  const info = visitInfo(intro.status === "fulfilled" ? intro.value : {}, detail.address, language);
  const hasVisitInfo = Object.entries(info).some(
    ([key, value]) => key !== "address" && Boolean(value),
  );
  return {
    status: "available",
    language,
    officialLanguage: language,
    contentId: detail.contentId,
    title: detail.title,
    address: detail.address,
    overview,
    visitInfo: info,
    homepage: safeHomepage(common.value.row.homepage),
    unavailableSections: [
      ...(!overview ? ["overview" as const] : []),
      ...(!hasVisitInfo ? ["visitInfo" as const] : []),
    ],
    provenance: {
      provider: "한국관광공사",
      service: INTERNATIONAL_TOUR_SERVICES[language],
      endpoint: base(language),
      originalContentId: spot.sourceContentId,
      foreignContentId: detail.contentId,
      matchedBy: match.method,
      distanceMeters: match.distanceMeters,
      retrievedAt: common.value.retrievedAt,
      modifiedAt: detail.modifiedAt,
    },
  };
}
