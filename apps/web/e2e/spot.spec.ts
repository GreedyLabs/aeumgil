// §8.1 시나리오 2 — 스팟 상세: 혼잡/날씨/적합성 배지 렌더(값 유무만).
// 공공 API 가 실패해도 DB 기본값으로 렌더되므로(폴백 설계) 값의 존재만 확인한다.

import { expect, test } from "@playwright/test";

test("스팟 상세에 혼잡·적합성·날씨 값이 렌더된다", async ({ page }) => {
  await page.goto("/spot/sokcho-market");

  // 방문 적합성: 레이블 + "NN/100" 점수
  await expect(page.getByText("방문 적합성").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^\d{1,3}\/100$/).first()).toBeVisible();

  // 혼잡 Signal: 여유/보통/혼잡 중 하나
  await expect(page.getByText(/^(여유|보통|혼잡)$/).first()).toBeVisible();

  // 날씨: 온도 표기(예: 23°)
  await expect(page.getByText(/-?\d+°/).first()).toBeVisible();
});
