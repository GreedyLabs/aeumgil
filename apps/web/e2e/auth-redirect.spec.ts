// §8.1 시나리오 3 — 비로그인 쓰기 시도/보호 라우트 → /login 리다이렉트.
// 클라이언트 가드(requireAuth)와 서버 가드(requireUserSession) 양쪽을 확인한다.

import { expect, test } from "@playwright/test";

test("비로그인으로 코스 저장을 누르면 /login?reason=save 로 보낸다", async ({ page }) => {
  await page.goto("/course/east-sea-sunrise");
  await page
    .getByRole("button", { name: "테마 보관", exact: true })
    .first()
    .click({ timeout: 60_000 });
  await page.waitForURL(/\/login\?reason=save/);
});

test("비로그인 /saved 접근은 서버 가드가 /login 으로 보낸다", async ({ page }) => {
  await page.goto("/saved");
  await page.waitForURL(/\/login\?reason=save/);
  await expect(page).toHaveURL(/\/login/);
});
