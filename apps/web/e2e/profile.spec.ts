import { expect, test } from "@playwright/test";
import { sessionCookie } from "./helpers/session";

for (const width of [390, 1440]) {
  test(`${width}px 회원 화면에서 기록·취향·설정 흐름과 폼 레이아웃이 동작한다`, async ({
    page,
    context,
  }) => {
    await context.addCookies([await sessionCookie()]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "E2E 테스터님의 여행" })).toBeVisible();
    await page.getByRole("link", { name: "프로필 편집", exact: true }).click();
    await expect(page).toHaveURL(/\/profile\/edit/);
    for (const route of [
      "/profile/edit",
      "/reviews",
      "/reviews?tab=visits",
      "/settings",
      "/onboarding",
    ]) {
      await page.goto(route);
      await expect(page.locator(".screen-body")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        route,
      ).toBe(false);
    }
    await page.goto("/profile");
    await page.getByRole("link", { name: "여행 취향 설정" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });
}
