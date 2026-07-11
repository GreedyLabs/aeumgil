// ─────────────────────────────────────────────
// 한국관광공사 국문 관광정보 서비스(TourAPI KorService2) 클라이언트 — 서버 전용.
// 포털: https://www.data.go.kr/data/15101578/openapi.do
// base: http://apis.data.go.kr/B551011/KorService2
//
// 용도: 강원(areaCode=32) 관광지/음식점/숙박 기본정보 수집 → 큐레이션 스팟 보강.
// 동적 데이터(혼잡도/날씨/대기질)는 별도 클라이언트(Phase 3)에서 결합한다.
// ─────────────────────────────────────────────

import { requireEnv } from "@/lib/env";
import { callDataGoKr } from "./http";

const BASE = "http://apis.data.go.kr/B551011/KorService2";

/** 강원특별자치도 지역코드 */
export const GANGWON_AREA_CODE = 32;

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
  contentid?: string;
  contenttypeid?: string;
  title?: string;
  addr1?: string;
  areacode?: string;
  sigungucode?: string;
  firstimage?: string;
  mapx?: string;
  mapy?: string;
  tel?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
}

function toItem(r: RawItem): TourItem {
  return {
    contentId: r.contentid ?? "",
    contentTypeId: r.contenttypeid ?? "",
    title: r.title ?? "",
    addr: r.addr1 ?? "",
    areaCode: r.areacode ?? "",
    sigunguCode: r.sigungucode ?? "",
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
  /** 정렬: O(제목) Q(수정일) R(생성일) C(수정일+대표이미지) */
  arrange?: "O" | "Q" | "R" | "C";
}

/** 강원 지역기반 관광정보 목록 */
export async function listGangwonItems(options: SearchOptions = {}): Promise<TourItem[]> {
  const { pageNo = 1, numOfRows = 30, contentTypeId, sigunguCode, arrange = "C" } = options;
  const params: Record<string, string | number> = {
    ...COMMON,
    areaCode: GANGWON_AREA_CODE,
    numOfRows,
    pageNo,
    arrange,
  };
  if (contentTypeId) params.contentTypeId = contentTypeId;
  if (sigunguCode) params.sigunguCode = sigunguCode;

  const data = await callDataGoKr<RawListResponse>(`${BASE}/areaBasedList2`, params, {
    serviceKey: requireEnv("TOUR_API_SERVICE_KEY"),
  });
  return extractItems(data);
}

/**
 * 강원 키워드 검색 (searchKeyword2) — 대체지 후보 조회용.
 * 지역기반 목록(areaBasedList2)+제목 근사 필터와 달리, 포털 검색엔진이 키워드
 * 관련 POI 를 돌려주므로 "시장"·"해변" 같은 대체지 키워드에 맞는 결과가 온다(§4.5).
 */
export async function searchGangwonKeyword(keyword: string, options: SearchOptions = {}): Promise<TourItem[]> {
  const { pageNo = 1, numOfRows = 20, contentTypeId, sigunguCode, arrange = "C" } = options;
  const params: Record<string, string | number> = {
    ...COMMON,
    areaCode: GANGWON_AREA_CODE,
    keyword,
    numOfRows,
    pageNo,
    arrange,
  };
  if (contentTypeId) params.contentTypeId = contentTypeId;
  if (sigunguCode) params.sigunguCode = sigunguCode;

  const data = await callDataGoKr<RawListResponse>(`${BASE}/searchKeyword2`, params, {
    serviceKey: requireEnv("TOUR_API_SERVICE_KEY"),
  });
  return extractItems(data);
}

export interface TourDetail extends TourItem {
  overview: string;
  homepage: string;
  zipcode: string;
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
  const data = await callDataGoKr<RawListResponse & { response?: { body?: { items?: { item?: (RawItem & { overview?: string; homepage?: string; zipcode?: string })[] } } } }>(
    `${BASE}/detailCommon2`,
    {
      ...COMMON,
      contentId,
      numOfRows: 1,
      pageNo: 1,
    },
    { serviceKey: requireEnv("TOUR_API_SERVICE_KEY") },
  );
  const items = extractItems(data);
  const base = items[0];
  if (!base) return null;
  const raw = (data.response?.body?.items as { item?: { overview?: string; homepage?: string; zipcode?: string }[] })?.item?.[0];
  return {
    ...base,
    overview: raw?.overview ?? "",
    homepage: raw?.homepage ?? "",
    zipcode: raw?.zipcode ?? "",
  };
}
