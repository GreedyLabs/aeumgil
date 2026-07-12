// §8.1 시나리오 5 — (로그인 픽스처) 리뷰 작성 → /reviews 반영.
// 리뷰 본문에 타임스탬프를 넣어 이번 실행분임을 확정적으로 확인한다.

import { expect, test } from "@playwright/test";
import { sessionCookie } from "./helpers/session";

test("리뷰 작성이 reviews 화면에 반영된다", async ({ page, context }) => {
  await context.addCookies([await sessionCookie()]);

  await page.goto("/spot/sokcho-market");
  await expect(page.getByText("짧은 리뷰")).toBeVisible({ timeout: 60_000 });

  const reviewText = `E2E 자동 리뷰 ${Date.now()}`;
  await page.getByRole("button", { name: "5점" }).click();
  await page.getByPlaceholder("좋았던 점을 5자 이상 적어주세요").fill(reviewText);
  await page.getByRole("button", { name: "리뷰 저장·갱신" }).click();
  await expect(page.getByText("리뷰를 저장했어요")).toBeVisible();

  await page.goto("/reviews");
  await expect(page.getByText(reviewText)).toBeVisible();
});
