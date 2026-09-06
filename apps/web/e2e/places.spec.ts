import { expect, test } from "@playwright/test";

test("전체 관광지는 스크롤로 누적되고 검색·지역 변경 시 새 결과부터 보여 준다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/map", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".place-card")).toHaveCount(24);
  const firstPlaces = await page
    .locator(".place-card-actions a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  await page.locator(".place-card-select").first().click();
  const selectedHeading = await page.locator(".places-map-heading h2").innerText();
  await page.locator("#places-load-more").scrollIntoViewIfNeeded();
  await expect(page.locator(".place-card")).toHaveCount(48);
  const loadedPlaces = await page
    .locator(".place-card-actions a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(loadedPlaces.slice(0, 24)).toEqual(firstPlaces);
  expect(new Set(loadedPlaces).size).toBe(48);
  await expect(page.locator(".place-card.is-selected .place-card-actions a")).toHaveAttribute(
    "href",
    firstPlaces[0]!,
  );
  await expect(page.locator(".places-map-heading h2")).toHaveText(selectedHeading);
  await expect(page).not.toHaveURL(/page=/);
  await page.getByRole("searchbox", { name: "관광지 검색" }).fill("속초 해변");
  await expect(page).toHaveURL(/q=/);
  await expect(
    page.getByRole("button", { name: "속초해수욕장 지도 보기", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".place-card").count()).toBeLessThan(24);
  await page.getByRole("combobox", { name: "여행지 지역" }).selectOption("양구");
  await expect(page.getByRole("heading", { name: "검색 결과가 없어요" })).toBeVisible();
  await page.getByRole("button", { name: "전체 여행지 보기" }).click();
  await page.getByRole("searchbox", { name: "관광지 검색" }).fill("박수근미술관");
  await expect(
    page.getByRole("button", { name: "박수근미술관 지도 보기", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "박수근미술관 지도 보기" }).click();
  await expect(page.locator('iframe[title="박수근미술관 위치 지도"]')).toHaveAttribute(
    "src",
    /openstreetmap/,
  );
  await page.screenshot({
    path: "/private/tmp/eumgil-places-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "사진·이용 안내 보기" }).click();
  await expect(page.getByRole("heading", { name: "박수근미술관", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "박수근미술관", exact: true }).first()).toBeVisible();
});

test("기존 페이지 직접 링크는 해당 결과부터 이어서 읽을 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/map?page=2", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".place-card")).toHaveCount(24);
  await expect(page.getByRole("link", { name: "첫 여행지부터 보기" })).toHaveAttribute(
    "href",
    /tab=places/,
  );
  const first = await page.locator(".place-card-actions a").first().getAttribute("href");
  await page.locator("#places-load-more").scrollIntoViewIfNeeded();
  await expect(page.locator(".place-card")).toHaveCount(48);
  await expect(page.locator(".place-card-actions a").first()).toHaveAttribute("href", first!);
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("link", { name: "첫 여행지부터 보기" }).click();
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.locator(".place-card")).toHaveCount(24);
});

test("추가 조회 실패는 기존 여행지를 보존하고 명시적으로 재시도할 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/discover?tab=places", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".place-card")).toHaveCount(24);
  const initial = await page
    .locator(".place-card-actions a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  let attempts = 0;
  await page.route("**/discover*", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      attempts++;
      if (attempts === 1) {
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await page.locator("#places-load-more").scrollIntoViewIfNeeded();
  const retry = page.getByRole("button", { name: "여행지 다시 불러오기", exact: true });
  await expect(retry).toBeVisible();
  await expect(page.locator("#places-load-more").getByRole("alert")).toContainText("다시 시도");
  await expect(page.locator(".place-card")).toHaveCount(24);
  // 관찰 영역에 머물러도 실패한 요청을 자동으로 반복하지 않는지 확인한다.
  await page.waitForTimeout(500);
  expect(attempts).toBe(1);
  expect(
    await page
      .locator(".place-card-actions a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(initial);
  await retry.click();
  await expect(page.locator(".place-card")).toHaveCount(48);
  expect(attempts).toBe(2);
  await expect(page.locator("#places-load-more").getByRole("alert")).toHaveCount(0);
});

test("모바일 지도 패널은 목록 위치·선택·누적 결과를 보존하며 열고 닫힌다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/map?region=양양", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/discover\?tab=places/);
  await expect(page.locator(".places-map-sheet")).toHaveCount(1);
  await expect(page.locator(".place-card")).toHaveCount(24);
  await page.locator("#places-load-more").scrollIntoViewIfNeeded();
  await expect(page.locator(".place-card")).toHaveCount(48);
  const places = await page
    .locator(".place-card-actions a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  const card = page.locator(".place-card-select").nth(30);
  await card.scrollIntoViewIfNeeded();
  const originalY = await page.evaluate(() => window.scrollY);
  const originalBox = await card.boundingBox();
  await card.click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator(".places-map-heading h2")).toHaveText(
    (await card.locator(".place-card-title").innerText()).trim(),
  );
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - originalY)).toBeLessThan(2);
  await page.mouse.move(20, 20);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(300);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - originalY)).toBeLessThan(2);
  await expect(page.locator(".place-card")).toHaveCount(48);
  await page.screenshot({
    path: "/private/tmp/eumgil-places-mobile-sheet.png",
    animations: "disabled",
  });
  await panel.getByRole("button", { name: "지도 닫기" }).click();
  await expect(panel).not.toBeVisible();
  await expect(card).toBeFocused();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - originalY)).toBeLessThan(2);
  expect(await card.boundingBox()).toEqual(originalBox);
  expect(
    await page
      .locator(".place-card-actions a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(places);
  const reopen = page.locator(".places-map-reopen");
  await reopen.click();
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(reopen).toBeFocused();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - originalY)).toBeLessThan(2);
  await reopen.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(panel).not.toBeVisible();
  await page.locator("#places-load-more").scrollIntoViewIfNeeded();
  await expect(page.locator(".place-card")).toHaveCount(72);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  await reopen.click();
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".places-map-sheet")).toHaveCount(0);
  await expect(page.locator("aside.places-map")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(panel).toBeVisible();
  const panelBox = await panel.boundingBox();
  expect(panelBox?.x).toBeGreaterThanOrEqual(0);
  expect(panelBox?.y).toBeGreaterThanOrEqual(0);
  expect(panelBox?.width).toBeLessThanOrEqual(320);
  expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(641);
  await expect(panel.getByRole("button", { name: "지도 닫기" })).toBeInViewport();
  await page.screenshot({
    path: "/private/tmp/eumgil-places-mobile-sheet-320.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
});

test("새 지역 테마는 실제 장소로 구성되고 검색할 수 있다", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "테마 지역" }).selectOption("양구");
  await expect(page.locator(".theme-grid")).toContainText("양구");
  await expect(page.locator(".theme-grid")).not.toContainText("0개 장소");
  await page.goto("/course/gangwon-yanggu-culture", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /양구.*전시/ }).first()).toBeVisible();
  await expect(
    page.locator(".course-timeline").getByText("박수근미술관", { exact: true }).first(),
  ).toBeVisible();
});
