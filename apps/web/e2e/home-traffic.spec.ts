import { expect, test } from "@playwright/test";

test("홈 하단 교통 요약은 지역 탐색 다음에 있고 PC·모바일에서 구간을 읽을 수 있다", async ({
  page,
}) => {
  await page.goto("/");
  const traffic = page.getByTestId("home-traffic");
  await expect(traffic).toBeVisible({ timeout: 20_000 });
  await expect(traffic.getByRole("article")).toHaveCount(3);
  await expect(traffic.getByRole("heading", { name: "영동고속도로", exact: true })).toBeVisible();
  await expect(
    traffic.getByRole("heading", { name: "서울양양고속도로", exact: true }),
  ).toBeVisible();
  await expect(traffic.getByRole("heading", { name: "동해고속도로", exact: true })).toBeVisible();
  await expect(traffic.getByRole("link", { name: /도로공사 교통 지도/ })).toHaveAttribute(
    "href",
    "https://www.roadplus.co.kr/",
  );
  expect(
    await traffic.evaluate((section) => {
      const previous = document.querySelector(".home-region-entry")!;
      const footer = document.querySelector(".home-footer")!;
      return (
        Boolean(previous.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        Boolean(section.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    }),
  ).toBe(true);
  await traffic.locator("summary").filter({ hasText: "속도와 구간 표시 기준" }).click();
  await expect(traffic).toContainText("정체 길이를 나타내지 않아요");
  await expect(traffic).toContainText("최저속도");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await traffic.scrollIntoViewIfNeeded();
    const spacing = await traffic.evaluate((section) => {
      const box = section.getBoundingClientRect();
      const previous = document.querySelector(".home-region-entry")!.getBoundingClientRect();
      return { gap: box.top - previous.bottom, left: box.left, right: innerWidth - box.right };
    });
    expect(spacing.gap).toBeGreaterThanOrEqual(width < 768 ? 28 : 32);
    if (width < 768) {
      expect(spacing.left).toBeGreaterThanOrEqual(20);
      expect(spacing.right).toBeGreaterThanOrEqual(20);
    }
    expect(
      await traffic.evaluate((section) => ({
        page: document.documentElement.scrollWidth > innerWidth + 1,
        section: section.scrollWidth > section.clientWidth + 1,
        cards: [...section.querySelectorAll("article")].some(
          (card) => card.scrollWidth > card.clientWidth + 1,
        ),
      })),
    ).toEqual({ page: false, section: false, cards: false });
  }
  await page.goto("/discover?tab=visitors");
  await expect(page.getByRole("heading", { name: "지역별 방문 규모" })).toBeVisible();
  await expect(page.getByTestId("home-traffic")).toHaveCount(0);
});
