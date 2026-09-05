// ─────────────────────────────────────────────
// 한국관광공사 국문 관광정보 서비스(TourAPI KorService2) 클라이언트 — 서버 전용.
// 포털: https://www.data.go.kr/data/15101578/openapi.do
// base: https://apis.data.go.kr/B551011/KorService2
//
// 용도: 강원(lDongRegnCd=51) 관광지/음식점/숙박 기본정보 수집 → 큐레이션 스팟 보강.
// 동적 데이터(혼잡도/날씨/대기질)는 별도 클라이언트(Phase 3)에서 결합한다.
// ─────────────────────────────────────────────

import { requireEnv } from "@/lib/env";
import { callDataGoKr } from "./http";
import type { Festival, Spot } from "@/domain/types";
import { L } from "@/lib/i18n";

const BASE = "https://apis.data.go.kr/B551011/KorService2";

/** 강원특별자치도 지역코드 */
export const GANGWON_AREA_CODE = 51;

/** contentTypeId — 12:관광지 14:문화시설 15:행사 25:여행코스 28:레포츠 32:숙박 38:쇼핑 39:음식점 */
export const CONTENT_TYPE = {
  spot: 12,
  culture: 14,
  event: 15,
  course: 25,
  leports: 28,
  stay: 32,
  shopping: 38,
  food: 39,
} as const;

const COMMON = { MobileOS: "ETC", MobileApp: "eumgil", _type: "json" };

export interface TourItem {
  contentId: string;
  contentTypeId: string;
  title: string;
  addr: string;
  areaCode: string;
  sigunguCode: string;
  /** 대표 이미지 URL (없을 수 있음) */
  image: string;
  /** 경도 / 위도 */
  mapX: number;
  mapY: number;
  tel: string;
  cat1: string;
  cat2: string;
  cat3: string;
}

interface RawListResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      totalCount?: number;
      items?: { item?: RawItem[] | RawItem } | "";
    };
  };
}

interface RawItem {
  eventstartdate?: string;
  eventenddate?: string;
  contentid?: string;
  contenttypeid?: string;
  title?: string;
  addr1?: string;
  areacode?: string;
  sigungucode?: string;
  firstimage?: string;
  lDongRegnCd?: string;
  lDongSignguCd?: string;
  mapx?: string;
  mapy?: string;
  tel?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  overview?: string;
  homepage?: string;
  zipcode?: string;
}

/** 종료된 행사와 불완전한 날짜는 표시하지 않는다. YYYYMMDD 기준 비교. */
export function normalizeFestivals(raw: RawItem[], from: string, through: string): Festival[] {
  const iso = (value: string) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const dateValid = (value: string) =>
    /^\d{8}$/.test(value) &&
    Number.isFinite(Date.parse(iso(value))) &&
    new Date(iso(value)).toISOString().slice(0, 10) === iso(value);
  return raw
    .filter(
      (item) =>
        item.contentid &&
        item.title &&
        item.eventstartdate &&
        item.eventenddate &&
        dateValid(item.eventstartdate) &&
        dateValid(item.eventenddate) &&
        item.eventstartdate <= item.eventenddate &&
        item.eventenddate >= from &&
        item.eventstartdate <= through,
    )
    .sort((a, b) => a.eventstartdate!.localeCompare(b.eventstartdate!))
    .map((item) => ({
      id: item.contentid!,
      name: L(item.title!),
      startsOn: iso(item.eventstartdate!),
      endsOn: iso(item.eventenddate!),
      address: item.addr1 ?? "",
      imageUrl: item.firstimage || undefined,
    }));
}

/** 조회 기간에 겹치는 진행 중·예정 강원 행사를 조회한다. */
export async function listGangwonFestivals(from: string, through: string): Promise<Festival[]> {
  const data = await callDataGoKr<RawListResponse>(
    `${BASE}/searchFestival2`,
    {
      ...COMMON,
      lDongRegnCd: GANGWON_AREA_CODE,
      eventStartDate: from,
      eventEndDate: through,
      numOfRows: 100,
      pageNo: 1,
      arrange: "A",
    },
    { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
  );
  const items = data.response?.body?.items;
  const rows = items && items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
  return normalizeFestivals(rows, from, through);
}

function toItem(r: RawItem): TourItem {
  return {
    contentId: r.contentid ?? "",
    contentTypeId: r.contenttypeid ?? "",
    title: r.title ?? "",
    addr: r.addr1 ?? "",
    areaCode: r.lDongRegnCd ?? r.areacode ?? "",
    sigunguCode: r.lDongSignguCd ?? r.sigungucode ?? "",
    image: r.firstimage ?? "",
    mapX: r.mapx ? Number(r.mapx) : 0,
    mapY: r.mapy ? Number(r.mapy) : 0,
    tel: r.tel ?? "",
    cat1: r.cat1 ?? "",
    cat2: r.cat2 ?? "",
    cat3: r.cat3 ?? "",
  };
}

function extractItems(data: RawListResponse): TourItem[] {
  const items = data.response?.body?.items;
  if (!items) return [];
  const arr = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  return arr.map(toItem);
}

export interface SearchOptions {
  pageNo?: number;
  numOfRows?: number;
  contentTypeId?: number;
  /** 시군구 코드 (강원 내 세부 지역) */
  sigunguCode?: number;
  /** 정렬: A/C/D(제목/수정/생성일), O/Q/R(대표이미지 필수) */
  arrange?: "A" | "C" | "D" | "O" | "Q" | "R";
}

/** 강원 지역기반 관광정보 목록 */
export async function listGangwonItems(options: SearchOptions = {}): Promise<TourItem[]> {
  const { pageNo = 1, numOfRows = 30, contentTypeId, sigunguCode, arrange = "C" } = options;
  const params: Record<string, string | number> = {
    ...COMMON,
    lDongRegnCd: GANGWON_AREA_CODE,
    numOfRows,
    pageNo,
    arrange,
  };
  if (contentTypeId) params.contentTypeId = contentTypeId;
  if (sigunguCode) params.lDongSignguCd = sigunguCode;

  const data = await callDataGoKr<RawListResponse>(`${BASE}/areaBasedList2`, params, {
    serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY"),
  });
  return extractItems(data);
}

/**
 * 강원 키워드 검색 (searchKeyword2) — 대체지 후보 조회용.
 * 지역기반 목록(areaBasedList2)+제목 근사 필터와 달리, 포털 검색엔진이 키워드
 * 관련 POI 를 돌려주므로 "시장"·"해변" 같은 대체지 키워드에 맞는 결과가 온다(§4.5).
 */
export async function searchGangwonKeyword(
  keyword: string,
  options: SearchOptions = {},
): Promise<TourItem[]> {
  const { pageNo = 1, numOfRows = 20, contentTypeId, sigunguCode, arrange = "C" } = options;
  const params: Record<string, string | number> = {
    ...COMMON,
    lDongRegnCd: GANGWON_AREA_CODE,
    keyword,
    numOfRows,
    pageNo,
    arrange,
  };
  if (sigunguCode) params.lDongSignguCd = sigunguCode;

  const data = await callDataGoKr<RawListResponse>(`${BASE}/searchKeyword2`, params, {
    serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY"),
  });
  return extractItems(data).filter(
    (item) => !contentTypeId || item.contentTypeId === String(contentTypeId),
  );
}

export interface TourDetail extends TourItem {
  overview: string;
  homepage: string;
  zipcode: string;
  photos?: Spot["photos"];
  visitInfo?: Spot["visitInfo"];
  festivalInfo?: Record<string, string>;
}

export function cleanTourText(value: string | undefined): string {
  return (value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

type TourEnvelope<T> = { response?: { body?: { items?: { item?: T | T[] } | "" } } };
function rows<T>(data: TourEnvelope<T>): T[] {
  const items = data.response?.body?.items;
  return items && items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
}

export function normalizeVisitInfo(
  raw: Record<string, string>,
  address: string,
): NonNullable<Spot["visitInfo"]> {
  const first = (...keys: string[]) => keys.map((key) => cleanTourText(raw[key])).find(Boolean);
  return {
    address,
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

/**
 * 콘텐츠 공통 상세(개요/주소/좌표/대표이미지).
 *
 * ⚠ KorService2 detailCommon2 는 구버전(KorService1)의 YN 플래그
 * (defaultYN/firstImageYN/addrinfoYN/mapinfoYN/overviewYN)를 받지 않는다.
 * 해당 플래그를 넘기면 빈 응답이 와서 보강이 조용히 실패한다(verify:enrichment 로 확인,
 * 2026-06-23). contentId 만 주면 공통 필드(개요/이미지/좌표)가 기본 포함된다.
 */
export async function getItemDetail(contentId: string): Promise<TourDetail | null> {
  const data = await callDataGoKr<
    RawListResponse & {
      response?: {
        body?: {
          items?: {
            item?: (RawItem & { overview?: string; homepage?: string; zipcode?: string })[];
          };
        };
      };
    }
  >(
    `${BASE}/detailCommon2`,
    {
      ...COMMON,
      contentId,
      numOfRows: 1,
      pageNo: 1,
    },
    { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
  );
  const items = extractItems(data);
  const base = items[0];
  if (!base) return null;
  const rawItems = (data.response?.body?.items as { item?: RawItem | RawItem[] })?.item;
  const raw = Array.isArray(rawItems) ? rawItems[0] : rawItems;
  // 세부 API가 실패해도 정상 공통 정보를 유지한다. 호출부에서 전체 상세를 24시간 캐시한다.
  const [images, intro] = await Promise.allSettled([
    callDataGoKr<TourEnvelope<{ originimgurl?: string; imgname?: string; cpyrhtDivCd?: string }>>(
      `${BASE}/detailImage2`,
      {
        ...COMMON,
        contentId,
        imageYN: "Y",
        numOfRows: 30,
        pageNo: 1,
      },
      { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
    ),
    callDataGoKr<TourEnvelope<Record<string, string>>>(
      `${BASE}/detailIntro2`,
      {
        ...COMMON,
        contentId,
        contentTypeId: base.contentTypeId,
        numOfRows: 1,
        pageNo: 1,
      },
      { serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY") },
    ),
  ]);
  const photos =
    images.status === "fulfilled"
      ? rows(images.value)
          .filter((p) => p.originimgurl && /^https?:\/\//.test(p.originimgurl))
          .map((p) => ({
            url: p.originimgurl!,
            label: p.imgname || base.title,
            license: p.cpyrhtDivCd || "",
          }))
      : [];
  const visit = intro.status === "fulfilled" ? rows(intro.value)[0] : undefined;
  return {
    ...base,
    // 대표사진이 없는 양떼목장 등은 추가 사진 중 재사용 가능한 공공누리 1유형을 사용한다.
    image: base.image || photos.find((p) => p.license === "Type1")?.url || "",
    photos,
    festivalInfo: base.contentTypeId === "15" ? visit : undefined,
    visitInfo: visit
      ? normalizeVisitInfo(visit, base.addr)
      : { address: base.addr, phone: base.tel || undefined },
    overview: (raw?.overview ?? "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&"),
    homepage: raw?.homepage ?? "",
    zipcode: raw?.zipcode ?? "",
  };
}
