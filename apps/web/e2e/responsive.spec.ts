import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1280, 1440, 1920]) {
  test(`${width}px 주요 화면이 가로 넘침 없이 동작한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "/",
      "/discover",
      "/course/east-sea-sunrise",
      "/spot/sokcho-market",
      "/map",
      "/theme/east-sea-sunrise",
      "/alternatives?spot=anmok-beach",
      "/profile",
      "/login",
    ]) {
      await page.goto(route);
      await expect(page.locator(".screen-body")).toBeVisible();
      const overflow = await page.evaluate(() => {
        const body = document.querySelector(".screen-body")!;
        return {
          page: document.documentElement.scrollWidth > innerWidth + 1,
          content: body.scrollWidth > body.clientWidth + 1,
        };
      });
      expect(overflow, route).toEqual({ page: false, content: false });
    }
  });
}

test("자연어 여행 조건이 코스에 전달되고 조건 변경 후에도 유지된다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "여행 목적" })
    .fill("부모님과 대중교통으로 1박 2일 바다 여행");
  await page.getByRole("button", { name: "여행 추천 받기" }).click();
  await page.waitForURL(/\/theme\//);
  await page.getByText("코스 자세히 보기").click();
  await page.waitForURL(/\/course\//);
  await expect(page).toHaveURL(/transport=transit/);
  await expect(page).toHaveURL(/companion=family/);
  await expect(page).toHaveURL(/days=2/);
  await page.getByRole("button", { name: "조건", exact: true }).click();
  await page.getByRole("button", { name: "1일", exact: true }).click();
  await page.getByRole("button", { name: "조건 적용" }).click();
  await expect(page).toHaveURL(/days=1/);
  await expect(page.getByRole("button", { name: "Day 2" })).toHaveCount(0);
});

test("탐색 검색과 테마 코스 진입 버튼이 동작한다", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("searchbox", { name: "테마 검색" }).fill("검색결과없는문장");
  await expect(page.getByRole("heading", { name: "찾는 테마가 아직 없어요" })).toBeVisible();
  await page.goto("/spot/sokcho-market");
  await page.getByRole("button", { name: "테마 코스 보기", exact: true }).last().click();
  await expect(page).toHaveURL(/\/course\//);
});

test("데스크톱은 본문 폭을 활용하고 문서 하나로 스크롤한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const layout = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const nav = document.querySelector(".desktop-nav")!;
    return {
      mainWidth: main.getBoundingClientRect().width,
      available: innerWidth - nav.getBoundingClientRect().width,
      innerScroll: getComputedStyle(main).overflowY,
    };
  });
  expect(layout.mainWidth).toBeGreaterThan(layout.available * 0.9);
  expect(layout.innerScroll).toBe("visible");
  await page.mouse.move(1420, 450);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(
    page
      .getByRole("navigation", { name: "주 메뉴" })
      .getByRole("button", { name: "지도", exact: true }),
  ).toBeVisible();
});

test("지도 장소를 선택하면 실제 좌표와 상세 링크가 바뀐다", async ({ page }) => {
  await page.goto("/map");
  await page.getByRole("button", { name: /월정사 선재길/ }).click();
  await expect(page.getByRole("link", { name: "장소 상세" })).toHaveAttribute(
    "href",
    "/spot/woljeongsa-trail",
  );
  await expect(page.locator('iframe[title="월정사 선재길 위치 지도"]')).toHaveAttribute(
    "src",
    /openstreetmap.org\/export\/embed.html/,
  );
});

test("행사 탐색과 로그인 안내에 동작 가능한 경로가 있다", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("button", { name: "다가오는 행사", exact: true }).click();
  await expect(page.getByRole("heading", { name: /다가오는 강원 행사/ })).toBeVisible();
  await expect(page.locator(".festival-section")).not.toContainText("불러오는 중");
  await page.goto("/login?reason=save&returnTo=%2Fcourse%2Feast-sea-sunrise");
  await expect(page.getByText("마음에 든 코스를 저장하려면 로그인해 주세요.")).toBeVisible();
  await page.getByRole("link", { name: "먼저 여행지 둘러보기" }).click();
  await expect(page).toHaveURL(/\/discover/);
});

test("로그인도 공통 내비게이션을 유지하고 사이드바 접기가 저장된다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await expect(page.getByRole("navigation", { name: "주 메뉴" })).toBeVisible();
  await page.getByRole("button", { name: "사이드바 접기", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "사이드바 펼치기", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("button", { name: "탐색", exact: true })
    .click();
  await expect(page).toHaveURL(/\/discover/);
  await page.getByRole("button", { name: "사이드바 펼치기", exact: true }).click();
});

test("공공 예측·이용안내·사진과 지역 통계가 모바일에서 실제로 표시된다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spot/anmok-beach");
  await expect(page.getByRole("heading", { name: "언제 가면 여유로울까요?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이용 안내", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "30일 예측 보기" }).click();
  await expect(page.locator(".forecast-day")).toHaveCount(30);
  await page
    .locator(".photo-disclosure")
    .filter({ hasText: "관광지 사진" })
    .locator("summary")
    .click();
  const photo = page.locator(".spot-photo-grid img").first();
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  await page.screenshot({ path: "/private/tmp/eumgil-mobile-api.png", fullPage: true });
  await page.goto("/discover");
  await page.getByRole("button", { name: "지역 방문 통계", exact: true }).click();
  await expect(page.getByRole("heading", { name: "지역별 방문 규모" })).toBeVisible();
  await page.getByRole("link", { name: "강릉 지도에서 보기 →", exact: true }).click();
  await expect(page.getByRole("button", { name: "강릉", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /월정사 선재길/ })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/spot/anmok-beach");
  await page.screenshot({ path: "/private/tmp/eumgil-desktop-api.png", fullPage: true });
  await page.goto("/login");
  await page.screenshot({ path: "/private/tmp/eumgil-desktop-login.png", fullPage: true });
});
