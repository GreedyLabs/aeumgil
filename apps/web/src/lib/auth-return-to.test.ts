import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./auth-return-to";

describe("로그인 후 복귀 주소", () => {
  it("여행 조건과 장소 주소를 유지한다", () => {
    expect(safeReturnTo("/course/east-sea-sunrise?days=2&transport=transit")).toBe(
      "/course/east-sea-sunrise?days=2&transport=transit",
    );
    expect(safeReturnTo("/spot/sokcho-market")).toBe("/spot/sokcho-market");
  });
  it("외부 주소·인증 루프·경로 우회는 프로필로 보낸다", () => {
    for (const path of [
      "https://example.com",
      "//example.com",
      "/login",
      "/api/auth/signin",
      "/profile/../../login",
      "/profile\\example.com",
      "/profile/%2e%2e/api/auth/signin",
    ])
      expect(safeReturnTo(path)).toBe("/profile");
  });
});

it("개인 코스와 행사 화면도 로그인 뒤 원래 경로로 돌아간다", () => {
  expect(safeReturnTo("/my-courses/new?festival=734219&spot=tour-1")).toBe(
    "/my-courses/new?festival=734219&spot=tour-1",
  );
  expect(safeReturnTo("/festival/734219")).toBe("/festival/734219");
});
