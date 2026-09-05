import { expect, test } from "@playwright/test";

test("코스 더 보기는 목록과 충분히 떨어져 있고 기간별 테마를 찾을 수 있다", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/discover");
    const more = page.getByRole("button", { name: "코스 더 보기", exact: true });
    await expect(more).toBeVisible();
    await expect(page.locator("#theme-results > .theme-card")).toHaveCount(18);
    const firstOrder = await page
      .locator("#theme-results > .theme-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
    const space = await page.locator(".theme-load-more").evaluate((element) => {
      const list = document.querySelector("#theme-results")!.getBoundingClientRect();
      const controls = element.getBoundingClientRect();
      return {
        gap: controls.top - list.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(space.gap).toBeGreaterThanOrEqual(28);
    expect(space.overflow).toBe(false);
    await more.click();
    await expect(page.locator("#theme-results > .theme-card")).toHaveCount(36);
    await page.getByRole("combobox", { name: "테마 여행 기간" }).selectOption("2");
    expect(await page.locator("#theme-results > .theme-card").count()).toBeGreaterThan(3);
    for (const card of await page.locator("#theme-results > .theme-card").all()) {
      await expect(card.locator(".theme-card-meta")).toContainText(/1박 2일|2일/);
    }
    await page.getByRole("combobox", { name: "테마 여행 기간" }).selectOption("");
    expect(
      await page
        .locator("#theme-results > .theme-card")
        .evaluateAll((cards) => cards.map((card) => card.getAttribute("href"))),
    ).toEqual(firstOrder);
    await page.getByRole("combobox", { name: "테마 여행 기간" }).selectOption("2");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/private/tmp/eumgil-curated-filter-${width}.png`,
      fullPage: false,
      animations: "disabled",
    });
  }
});

test("2~5일 편집 코스의 오후 도착·전체 일차·참고 자료가 실제 화면에 유지된다", async ({ page }) => {
  for (const days of [2, 3, 4, 5]) {
    await page.setViewportSize({ width: days % 2 ? 390 : 1440, height: 1000 });
    await page.goto("/discover");
    await page.getByRole("combobox", { name: "테마 여행 기간" }).selectOption(String(days));
    const card = page.locator("#theme-results > .theme-card").first();
    await expect(card).toHaveAttribute("href", /\/theme\/journey-/);
    await card.click();
    const info = page.getByRole("region", { name: "코스 구성 안내" });
    await expect(info).toBeVisible();
    await info.locator("summary").click();
    await expect(info.getByRole("link").first()).toHaveAccessibleName(
      /외부 사이트, 새 탭에서 열림/,
    );
    await page.getByRole("button", { name: "코스 자세히 보기" }).click();
    await expect(
      page.locator(".course-tabs > button").filter({ hasText: /^Day \d+$/ }),
    ).toHaveCount(days);
    const firstTime = page
      .locator(".course-timeline")
      .getByText(/^\d{2}:\d{2}$/)
      .first();
    await expect(firstTime).toBeVisible();
    expect(Number((await firstTime.innerText()).split(":")[0])).toBeGreaterThanOrEqual(12);
    for (let day = 1; day <= days; day++) {
      await page.getByRole("button", { name: `Day ${day}`, exact: true }).click();
      await expect(
        page
          .locator(".course-timeline")
          .getByText(/^\d{2}:\d{2}$/)
          .first(),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `/private/tmp/eumgil-curated-course-${days}.png`,
      fullPage: false,
      animations: "disabled",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
});
