// ─────────────────────────────────────────────
// 기상청 격자 좌표 변환 유틸 (위경도 → nx/ny) — 서버/클라이언트 무관 순수 함수.
//
// 기상청 동네예보(단기예보) API 는 위경도가 아니라 Lambert Conformal Conic(LCC)
// 격자 좌표(nx, ny)를 입력으로 받는다. 아래는 기상청이 공개한 표준 변환식
// (dfs_xy_conv)을 TypeScript 로 옮긴 것. 상수도 기상청 격자 정의 그대로.
//
// 검증: grid.test.ts 가 알려진 기준점을 확인한다.
//   - 서울 (37.5665, 126.9780)  → nx 60, ny 127
//   - 강릉 (37.7519, 128.8761)  → nx 92, ny 132
// ─────────────────────────────────────────────

/** 기상청 LCC 격자 좌표 */
export interface GridXY {
  nx: number;
  ny: number;
}

// 기상청 격자 정의 상수 (Lambert Conformal Conic)
const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = 30.0; // 표준 위도 1
const SLAT2 = 60.0; // 표준 위도 2
const OLON = 126.0; // 기준점 경도
const OLAT = 38.0; // 기준점 위도
const XO = 43; // 기준점 X 좌표(GRID)
const YO = 136; // 기준점 Y 좌표(GRID)

const DEGRAD = Math.PI / 180.0;

/**
 * 위경도(WGS84) → 기상청 동네예보 격자(nx, ny).
 *
 * @param lat 위도(degree)
 * @param lon 경도(degree)
 */
export function latLonToGrid(lat: number, lon: number): GridXY {
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

  return { nx, ny };
}
