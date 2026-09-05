import { expect, test } from "@playwright/test";

test("행사 정보·음식점 카드와 외부 링크가 PC·모바일에서 분리되어 읽힌다", async ({ page }) => {
  await page.goto("/festival/4106106", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "원주 국가유산야행", exact: true })).toBeVisible();
  await expect(page.locator(".festival-food-card")).toHaveCount(4);
  for (const width of [320, 390, 900, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await page.locator(".festival-detail-content").evaluate((element) => {
      const boxes = [...element.children].map((child) => child.getBoundingClientRect());
      return {
        gaps: boxes.slice(1).map((box, index) => box.top - boxes[index]!.bottom),
        cards: [...element.querySelectorAll(".festival-food-card")].map((wrapper) => {
          const card = wrapper.querySelector(".commerce-card")!.getBoundingClientRect();
          const button = wrapper.querySelector(":scope > .btn")!.getBoundingClientRect();
          const outer = wrapper.getBoundingClientRect();
          return {
            cardWidth: card.width,
            buttonWidth: button.width,
            outerWidth: outer.width,
            gap: button.top - card.bottom,
          };
        }),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout.overflow, `${width}px 가로 넘침`).toBe(false);
    for (const gap of layout.gaps) expect(gap, `${width}px 구획 간격`).toBeGreaterThanOrEqual(20);
    for (const card of layout.cards) {
      expect(Math.abs(card.cardWidth - card.buttonWidth), `${width}px 카드/버튼 폭`).toBeLessThan(
        1,
      );
      expect(Math.abs(card.cardWidth - card.outerWidth)).toBeLessThan(1);
      expect(card.gap).toBeGreaterThanOrEqual(10);
    }
  }
  await page.locator(".photo-disclosure > summary").click();
  const external = page.locator('#main-content a[target="_blank"][href^="http"]');
  expect(await external.count()).toBeGreaterThan(4);
  for (const link of await external.all()) {
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAccessibleName(/외부 사이트, 새 탭에서 열림/);
    expect(await link.locator('svg[aria-hidden="true"]').count()).toBeGreaterThan(0);
  }
});

test("여행지 선택 전후 카드와 내부 콘텐츠 위치가 움직이지 않는다", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/discover?tab=places&q=박수근", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".place-card")).toHaveCount(3);
    await expect(page.locator(".place-card-select").nth(1)).toBeEnabled();
    const measure = () =>
      page.locator(".place-card").evaluateAll((cards) =>
        cards.map((card) => {
          const outer = card.getBoundingClientRect();
          const title = card.querySelector(".place-card-title")!.getBoundingClientRect();
          const photo = card.querySelector(".place-card-photo")!.getBoundingClientRect();
          return [
            outer.width,
            outer.height,
            title.left - outer.left,
            title.top - outer.top,
            photo.left - outer.left,
            photo.top - outer.top,
          ];
        }),
      );
    const before = await measure();
    await page.locator(".place-card-select").nth(1).click();
    if (width < 1100) await page.getByRole("button", { name: "지도 닫기" }).click();
    await expect(page.locator(".place-card").nth(1)).toHaveClass(/is-selected/);
    const after = await measure();
    for (let i = 0; i < before.length; i++) {
      for (let j = 0; j < before[i]!.length; j++) {
        expect(
          Math.abs(before[i]![j]! - after[i]![j]!),
          `${width}px 카드 ${i}, 측정 ${j}`,
        ).toBeLessThan(0.1);
      }
    }
  }
});
