import { expect, test } from "@playwright/test";

test("전체 관광지의 검색·지역·종류·페이지 이동과 빈 결과가 동작한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/map", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".place-card")).toHaveCount(24);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("searchbox", { name: "관광지 검색" }).fill("속초 해변");
  await expect(page).toHaveURL(/q=/);
  await expect(
    page.getByRole("button", { name: "속초해수욕장 지도 보기", exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/page=2/);
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

test("모바일은 장소 목록부터 보여주고 위치 버튼으로 지도를 연다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/map?region=양양&category=sea", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/discover\?tab=places/);
  await expect(page.locator(".places-map")).toHaveCount(1);
  await expect(page.locator(".place-card").first()).toBeVisible();
  await expect(page.locator(".places-map")).not.toBeVisible();
  await page.locator(".place-card-select").first().click();
  await expect(page.locator(".places-map")).toBeVisible();
  await page.getByRole("button", { name: "지도 닫기" }).click();
  await expect(page.locator(".places-map")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  await expect(page.locator(".place-card img").first()).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/eumgil-places-mobile.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("새 지역 테마는 실제 장소로 구성되고 검색할 수 있다", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "테마 지역" }).selectOption("양구");
  await expect(page.locator(".theme-grid")).toContainText("양구");
  await expect(page.locator(".theme-grid")).not.toContainText("0개 장소");
  await page.goto("/course/gangwon-yanggu-culture", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /양구.*전시/ }).first()).toBeVisible();
  await expect(page.getByText("박수근미술관", { exact: true }).first()).toBeVisible();
});
