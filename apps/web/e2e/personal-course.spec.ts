import { expect, test } from "@playwright/test";
import { sessionCookie } from "./helpers/session";

test("개인 코스 생성·장소 편집·저장·재조회·소유자 격리·삭제", async ({
  page,
  context,
  browser,
}) => {
  await context.addCookies([await sessionCookie()]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/my-courses/new", { waitUntil: "domcontentloaded" });
  await page.getByLabel("코스 이름", { exact: true }).fill("E2E 나의 양구 여행");
  await page.getByRole("searchbox", { name: "내 코스 여행지 검색" }).fill("박수근미술관");
  await page.getByRole("button", { name: "박수근미술관 추가", exact: true }).click();
  await page.getByRole("searchbox", { name: "내 코스 여행지 검색" }).fill("양구백자박물관");
  await page.getByRole("button", { name: "양구백자박물관 추가", exact: true }).click();
  await expect(page.locator(".personal-stop-list li")).toHaveCount(2);
  await page.getByRole("button", { name: "양구백자박물관 위로", exact: true }).click();
  await expect(page.locator(".personal-stop-list li").first()).toContainText("양구백자박물관");
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  const url = page.url();
  await page.goto("/profile", { waitUntil: "domcontentloaded" });
  await expect(page.locator('.stat-card[href="/saved"] .stat-num')).toHaveText("1");
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("코스 이름", { exact: true })).toHaveValue("E2E 나의 양구 여행");
  await expect(page.locator(".personal-stop-list li").first()).toContainText("양구백자박물관");
  await expect(page.locator(".itinerary-pin")).toHaveCount(2);
  await page.screenshot({
    path: "/private/tmp/eumgil-personal-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const other = await browser.newContext();
  await other.addCookies([await sessionCookie("e2e-other-owner")]);
  const otherPage = await other.newPage();
  const response = await otherPage.goto(url, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await other.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "박수근미술관 제거", exact: true }).click();
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "저장된 코스" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: "/private/tmp/eumgil-personal-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/saved", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /E2E 나의 양구 여행/ }).click();
  await expect(page.locator(".personal-stop-list li")).toHaveCount(1);
  await page.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("link", { name: /E2E 나의 양구 여행/ })).toHaveCount(0);
});

test("무장애 필터와 관광지 카드 선택·상세 진입을 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/discover?tab=places&q=박수근", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".places-map")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "무장애 안내 있는 곳", exact: true }).check();
  await expect(page).toHaveURL(/accessibility=info/);
  await page.getByRole("button", { name: "박수근미술관 지도 보기", exact: true }).click();
  await expect(page).toHaveURL(/\/discover/);
  await expect(page.locator('iframe[title="박수근미술관 위치 지도"]')).toBeVisible();
  await page
    .locator(".place-card")
    .filter({ has: page.getByRole("button", { name: "박수근미술관 지도 보기", exact: true }) })
    .getByRole("link", { name: "상세 보기", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "함께 가기 전 확인할 편의시설" })).toBeVisible();
  await expect(
    page.getByText("주출입구는 계단이 있으나 보조출입구에는 경사로가 있음", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("강원 연결 고속도로", { exact: true })).toHaveCount(0);
});

test("사이드바 토글은 접고 펼쳐도 같은 위치이며 홈은 추천 3개를 우선한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".theme-card")).toHaveCount(3);
  expect((await page.locator(".desktop-nav").boundingBox())?.width).toBe(256);
  const before = await page
    .getByRole("button", { name: "사이드바 접기", exact: true })
    .boundingBox();
  await page.getByRole("button", { name: "사이드바 접기", exact: true }).click();
  const after = await page
    .getByRole("button", { name: "사이드바 펼치기", exact: true })
    .boundingBox();
  expect(after?.x).toBe(before?.x);
  expect(after?.y).toBe(before?.y);
  await page.getByRole("button", { name: "사이드바 펼치기", exact: true }).click();
  await page.screenshot({
    path: "/private/tmp/eumgil-home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("행사 상세에서 위치·인근 장소를 확인하고 행사와 여행지를 개인 코스에 저장한다", async ({
  page,
  context,
}) => {
  await context.addCookies([await sessionCookie()]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/festival/734219", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "동해 무릉제", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "함께 들를 여행지" })).toBeVisible();
  await expect(page.locator('iframe[title="동해 무릉제 위치 지도"]')).toHaveAttribute(
    "src",
    /openstreetmap/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: "/private/tmp/eumgil-festival-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "행사와 함께 담기", exact: true }).first().click();
  await expect(page.locator(".personal-stop-list li")).toHaveCount(2);
  await expect(
    page.locator(".personal-stop-list").getByText("동해 무릉제", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".personal-stop-list li")).toHaveCount(2);
  await page.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
});

test("추천 코스를 복사하고 다른 탭의 이전 버전 저장을 막는다", async ({ page, context }) => {
  await context.addCookies([await sessionCookie()]);
  await page.goto("/course/gangwon-gangneung-sea?days=1", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /내 코스로 편집/ }).click();
  await expect(page).toHaveURL(/\/my-courses\/new\?from=/);
  expect(await page.locator(".personal-stop-list li").count()).toBeGreaterThan(0);
  await page.getByLabel("코스 이름", { exact: true }).fill("E2E 추천 복사");
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  const stale = await context.newPage();
  await stale.goto(page.url(), { waitUntil: "domcontentloaded" });
  await stale.getByLabel("코스 이름", { exact: true }).fill("E2E 이전 탭 수정");
  await page.getByLabel("코스 이름", { exact: true }).fill("E2E 최신 변경");
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "저장된 코스" })).toBeVisible();
  await stale.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(
    stale.getByRole("alert").filter({ hasText: "코스를 저장하지 못했어요" }),
  ).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("코스 이름", { exact: true })).toHaveValue("E2E 최신 변경");
  stale.on("dialog", (dialog) => dialog.accept());
  await stale.close({ runBeforeUnload: false });
  await page.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
});
