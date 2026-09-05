import { expect, test } from "@playwright/test";

// 검색 결과에서 근거를 읽고 코스로 진입한다. 경유 화면의 자동 이동은 없다.
test("홈에서 자연어 검색 근거를 확인하고 여행 조건을 유지한 코스로 이동한다", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const input = page.getByRole("textbox", { name: "여행 목적" });
  await input.fill("강릉에서 부모님과 대중교통으로 1박 2일 바다 여행");
  await page.getByRole("button", { name: "여행 추천 받기", exact: true }).click();
  await expect(page).toHaveURL(/\/result\?/);
  await expect(page.getByRole("heading", { name: "이런 여행은 어떠세요?" })).toBeVisible();
  await expect(page.getByLabel("찾은 키워드")).toContainText("강릉");
  await expect(page.getByLabel("찾은 키워드")).toContainText("바다");
  const courseLink = page.getByRole("link", { name: "이 조건으로 코스 보기" });
  await expect(page.locator(".match-trip-facts")).toContainText("강릉");
  await expect(courseLink).toHaveAttribute("href", /\/course\/[^?]+/);
  await courseLink.click();
  await expect(page).toHaveURL(/\/course\//);
  await expect(page).toHaveURL(/days=2/);
  await expect(page).toHaveURL(/transport=transit/);
  await expect(page).toHaveURL(/companion=family/);
  await expect(
    page
      .locator(".course-timeline")
      .getByText(/^\d{2}:\d{2}$/)
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /테마 보관/ }).first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/result\?/);
  await expect(courseLink).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$|\/\?/);
});

test("모바일 검색은 제외 조건을 설명하고 무관 입력에서 임의 코스를 추천하지 않는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/result?q=${encodeURIComponent("강릉 바다 말고 숲 산책")}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByLabel("찾은 키워드")).toContainText("제외 · 바다");
  await expect(page.getByRole("link", { name: "이 조건으로 코스 보기" })).toHaveAttribute(
    "href",
    /\/course\/gangwon-gangneung-forest/,
  );
  await page.locator(".match-query-disclosure summary").click();
  await page.getByLabel("어떤 여행을 하고 싶나요?").fill("서버 계산 오류를 해결해줘");
  await page.getByRole("button", { name: "다시 찾기" }).click();
  await expect(page.getByRole("heading", { name: "조금 더 알려주세요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "이 조건으로 코스 보기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /여행지를 직접 찾아볼게요/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole("link", { name: "춘천 아이와 박물관", exact: true }).click();
  await expect(page.getByRole("link", { name: "이 조건으로 코스 보기" })).toHaveAttribute(
    "href",
    /\/course\/gangwon-chuncheon-culture/,
  );
});
