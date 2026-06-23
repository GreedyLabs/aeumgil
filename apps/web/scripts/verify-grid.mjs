#!/usr/bin/env node
// ─────────────────────────────────────────────
// 격자 좌표 변환 검증 스크립트 (네트워크 불필요).
//
// 사용법 (루트에서):
//   node apps/web/scripts/verify-grid.mjs
//
// grid.ts 와 동일한 기상청 표준 변환식(dfs_xy_conv)을 독립 구현하고,
// 알려진 기준점으로 ✓/✗ 를 출력한다. grid.ts 수정 시 이 기준점이 깨지면 안 된다.
// ─────────────────────────────────────────────

const RE = 6371.00877,
  GRID = 5.0,
  SLAT1 = 30.0,
  SLAT2 = 60.0,
  OLON = 126.0,
  OLAT = 38.0,
  XO = 43,
  YO = 136;
const DEGRAD = Math.PI / 180.0;

function latLonToGrid(lat, lon) {
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
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

// [이름, 위도, 경도, 기대 nx, 기대 ny]
// 서울은 기상청 공식 예시 좌표(60,127) — 알고리즘 정합성 기준점.
// 나머지는 해당 좌표에 대한 표준식 결정값 — grid.ts 회귀 가드.
const CASES = [
  ["서울 중구", 37.5665, 126.978, 60, 127],
  ["강릉시", 37.7519, 128.8761, 92, 132],
  ["속초시", 38.207, 128.5918, 87, 141],
  ["평창군", 37.3705, 128.3902, 84, 123],
];

let pass = 0;
console.log("\n격자 좌표 변환 검증\n──────────────────────────────");
for (const [name, lat, lon, ex, ey] of CASES) {
  const { nx, ny } = latLonToGrid(lat, lon);
  const ok = nx === ex && ny === ey;
  if (ok) pass++;
  console.log(
    `${ok ? "✓" : "✗"}  ${name.padEnd(8)} (${lat}, ${lon}) → nx ${nx}, ny ${ny}` +
      (ok ? "" : `  기대값 nx ${ex}, ny ${ey}`),
  );
}
console.log("──────────────────────────────");
console.log(`${pass}/${CASES.length} 통과\n`);
process.exit(pass === CASES.length ? 0 : 1);
