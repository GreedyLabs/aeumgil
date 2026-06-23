// 기상청 격자 좌표 변환 단위 테스트.
// 서울(60,127)은 기상청 공식 예시 좌표 → 알고리즘 정합성 기준점.
// 나머지는 해당 좌표의 표준식 결정값 → 회귀 가드.
// (기존 scripts/verify-grid.mjs 의 기준점을 정식 테스트로 이관)

import { describe, expect, it } from "vitest";
import { latLonToGrid } from "./grid";

interface GridCase {
  name: string;
  lat: number;
  lon: number;
  nx: number;
  ny: number;
}

const CASES: GridCase[] = [
  { name: "서울 중구", lat: 37.5665, lon: 126.978, nx: 60, ny: 127 },
  { name: "강릉시", lat: 37.7519, lon: 128.8761, nx: 92, ny: 132 },
  { name: "속초시", lat: 38.207, lon: 128.5918, nx: 87, ny: 141 },
  { name: "평창군", lat: 37.3705, lon: 128.3902, nx: 84, ny: 123 },
];

describe("latLonToGrid", () => {
  for (const c of CASES) {
    it(`${c.name} (${c.lat}, ${c.lon}) → nx ${c.nx}, ny ${c.ny}`, () => {
      expect(latLonToGrid(c.lat, c.lon)).toEqual({ nx: c.nx, ny: c.ny });
    });
  }

  it("정수 격자 좌표를 반환한다", () => {
    const { nx, ny } = latLonToGrid(37.8813, 127.7298); // 춘천
    expect(Number.isInteger(nx)).toBe(true);
    expect(Number.isInteger(ny)).toBe(true);
  });
});
