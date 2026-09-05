import { expect, test } from "@playwright/test";

test("테마는 스크롤로 이어지고 앞 목록·추천 순서와 기간 필터를 유지한다", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/discover");
    const boundary = page.locator("#theme-scroll-boundary");
    await expect(page.getByRole("button", { name: "코스 더 보기", exact: true })).toHaveCount(0);
    await expect(page.locator("#theme-results > .theme-card")).toHaveCount(18);
    const firstOrder = await page
      .locator("#theme-results > .theme-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
    const space = await boundary.evaluate((element) => {
      const list = document.querySelector("#theme-results")!.getBoundingClientRect();
      const controls = element.getBoundingClientRect();
      return {
        gap: controls.top - list.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(space.gap).toBeGreaterThanOrEqual(28);
    expect(space.overflow).toBe(false);
    await boundary.scrollIntoViewIfNeeded();
    await expect(page.locator("#theme-results > .theme-card")).toHaveCount(36);
    const expandedOrder = await page
      .locator("#theme-results > .theme-card")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
    expect(expandedOrder.slice(0, 18)).toEqual(firstOrder);
    expect(new Set(expandedOrder).size).toBe(36);
    await page.getByRole("combobox", { name: "테마 여행 기간" }).scrollIntoViewIfNeeded();
    await page.getByRole("combobox", { name: "테마 여행 기간" }).selectOption("2");
    expect(await page.locator("#theme-results > .theme-card").count()).toBeGreaterThan(3);
    for (const card of await page.locator("#theme-results > .theme-card").all()) {
      await expect(card.locator(".theme-card-meta")).toContainText(/1박 2일|2일/);
    }
    await page.getByRole("combobox", { name: "테마 여행 기간" }).selectOption("");
    await expect(page.locator("#theme-results > .theme-card")).toHaveCount(18);
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

test("자동 스크롤 미지원 환경에서도 키보드로 다음 테마를 읽고 마지막에서 멈춘다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "IntersectionObserver");
  });
  await page.goto("/discover");
  const next = page.getByRole("button", { name: "다음 테마 코스 불러오기", exact: true });
  await expect(next).toBeVisible();
  while (await next.count()) {
    await next.focus();
    await next.press("Enter");
  }
  const cards = page.locator("#theme-results > .theme-card");
  await expect(page.locator("#theme-scroll-boundary")).toContainText("목록을 모두 확인했어요");
  const count = await cards.count();
  expect(count).toBeGreaterThan(36);
  expect(
    new Set(await cards.evaluateAll((items) => items.map((item) => item.getAttribute("href"))))
      .size,
  ).toBe(count);
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
