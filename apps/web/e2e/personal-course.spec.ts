import { expect, test } from "@playwright/test";
import { sessionCookie } from "./helpers/session";

test("실제 여행 날짜와 8일차를 저장하고 기간 축소·날짜 미정 전환에서 장소를 보존한다", async ({
  page,
  context,
}) => {
  await context.addCookies([await sessionCookie()]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/my-courses/new?spot=sokcho-market", { waitUntil: "domcontentloaded" });
  await page.getByLabel("코스 이름", { exact: true }).fill("E2E 실제 날짜 8일 여행");
  await page.getByLabel("여행 시작일", { exact: true }).fill("2028-02-28");
  await page.getByLabel("여행 종료일", { exact: true }).fill("2028-03-06");
  await page.locator('.personal-stop-list input[type="date"]').fill("2028-03-06");
  await expect(page.locator(".personal-stop-list li")).toHaveCount(0);
  await page.getByLabel("편집할 날짜", { exact: true }).fill("2028-03-06");
  await expect(page.locator(".personal-stop-list li")).toHaveCount(1);

  await page.getByLabel("여행 시작일", { exact: true }).fill("2028-03-01");
  await expect(page.getByLabel("여행 종료일", { exact: true })).toHaveValue("2028-03-08");
  await expect(page.getByLabel("편집할 날짜", { exact: true })).toHaveValue("2028-03-08");
  await page.getByLabel("여행 종료일", { exact: true }).fill("2028-03-03");
  await expect(page.locator(".personal-date-range [role=alert]")).toContainText("Day 8");
  await expect(page.getByRole("button", { name: "내 코스 저장", exact: true })).toBeDisabled();
  await expect(page.locator(".personal-stop-list li")).toHaveCount(1);
  await page.getByLabel("여행 종료일", { exact: true }).fill("2028-03-08");
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  const savedUrl = page.url();
  const courseId = new URL(savedUrl).pathname.split("/").at(-1)!;
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("여행 시작일", { exact: true })).toHaveValue("2028-03-01");
  await expect(page.getByLabel("여행 종료일", { exact: true })).toHaveValue("2028-03-08");

  await page.goto("/my-courses/add?spot=dongmyeong-port", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "추가할 내 코스", exact: true }).selectOption(courseId);
  await page.getByLabel("추가할 날짜", { exact: true }).fill("2028-03-08");
  await page.getByRole("button", { name: "이 코스에 1곳 담기", exact: true }).click();
  await expect(page).toHaveURL(savedUrl);
  await page.getByLabel("편집할 날짜", { exact: true }).fill("2028-03-08");
  await expect(page.locator(".personal-stop-list li")).toHaveCount(2);
  await expect(page.getByLabel("여행 시작일", { exact: true })).toHaveValue("2028-03-01");
  await expect(page.getByLabel("여행 종료일", { exact: true })).toHaveValue("2028-03-08");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "날짜 미정으로", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "편집할 날짜", exact: true })).toHaveValue("8");
  await page.getByRole("spinbutton", { name: "동명항 날짜", exact: true }).fill("10");
  await page.getByRole("spinbutton", { name: "편집할 날짜", exact: true }).fill("10");
  await expect(page.locator(".personal-stop-list")).toContainText("동명항");
  await page.getByRole("button", { name: "편집할 날짜 이전 날", exact: true }).click();
  await expect(page.locator(".personal-stop-list li")).toHaveCount(0);
  await page.getByRole("button", { name: "편집할 날짜 다음 날", exact: true }).click();
  await expect(page.locator(".personal-stop-list")).toContainText("동명항");
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page.locator(".mobile-plan-save")).toContainText("저장된 코스");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("여행 시작일", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("여행 종료일", { exact: true })).toHaveValue("");
  await page.getByRole("spinbutton", { name: "편집할 날짜", exact: true }).fill("10");
  await expect(page.locator(".personal-stop-list")).toContainText("동명항");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
});

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
  await expect(page.locator(".mobile-plan-save")).toContainText("저장된 코스");
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
  await page.locator(".places-extra-filters summary").click();
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
  await page.getByRole("button", { name: "소개 더 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "소개 접기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "소개 접기", exact: true }).click();
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
  await page.goto("/course/journey-wonju-art-weekend?days=2&transport=transit", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("link", { name: /내 코스로 편집/ }).click();
  await expect(page).toHaveURL(/\/my-courses\/new\?from=/);
  expect(await page.locator(".personal-stop-list li").count()).toBeGreaterThan(0);
  await expect(page.getByRole("combobox", { name: "내 코스 이동수단" })).toHaveValue("transit");
  const copiedStart = await page.getByLabel("하루 출발 시간").inputValue();
  expect(copiedStart).toBe("13:00");
  const lodging = page.locator(".personal-stop-list li").last();
  const lodgingTime = lodging.locator('input[type="time"]');
  const lodgingArrival = page.locator(".route-stop-list > li > button small").last();
  await expect(lodgingTime).toHaveValue("17:30");
  await expect(lodgingArrival).toHaveText("17:30");
  await lodgingTime.fill("18:00");
  await expect(lodgingArrival).toHaveText("18:00");
  await lodging.getByRole("button", { name: /예정 시각 해제$/ }).click();
  await expect(lodgingTime).toHaveValue("");
  await expect(lodgingArrival).not.toHaveText("18:00");
  await lodgingTime.fill("18:00");
  await expect(page.getByLabel("이 날짜 출발 시간", { exact: true })).toHaveValue("13:00");
  await page.getByLabel("이 날짜 출발 시간", { exact: true }).fill("13:15");
  await page.getByLabel("편집할 날짜", { exact: true }).fill("2");
  await expect(page.getByLabel("이 날짜 출발 시간", { exact: true })).toHaveValue("09:00");
  await page.getByRole("button", { name: "기본 시간 사용", exact: true }).click();
  await expect(page.getByLabel("이 날짜 출발 시간", { exact: true })).toHaveValue(copiedStart);
  await page.getByLabel("이 날짜 출발 시간", { exact: true }).fill("09:15");
  await page.getByLabel("코스 이름", { exact: true }).fill("E2E 추천 복사");
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("이 날짜 출발 시간", { exact: true })).toHaveValue("13:15");
  await expect(lodgingTime).toHaveValue("18:00");
  await expect(lodgingArrival).toHaveText("18:00");
  await page.getByLabel("편집할 날짜", { exact: true }).fill("2");
  await expect(page.getByLabel("이 날짜 출발 시간", { exact: true })).toHaveValue("09:15");
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
  await expect(page.getByRole("combobox", { name: "내 코스 이동수단" })).toHaveValue("transit");
  await expect(page.getByLabel("하루 출발 시간")).toHaveValue(copiedStart);
  const originalUrl = page.url();
  await stale.reload({ waitUntil: "domcontentloaded" });
  await expect(
    stale.getByRole("button", { name: "이전 초안을 새 코스로 복구", exact: true }),
  ).toBeVisible();
  await stale.getByLabel("코스 이름", { exact: true }).fill("E2E 최신 버전의 미저장 편집");
  await stale.getByRole("link", { name: "내 여행", exact: true }).click();
  await expect(stale).toHaveURL(/\/saved$/);
  await stale.goBack();
  await expect(stale.getByLabel("코스 이름", { exact: true })).toHaveValue(
    "E2E 최신 버전의 미저장 편집",
  );
  await stale.getByRole("button", { name: "이전 초안을 새 코스로 복구", exact: true }).click();
  await expect(stale).toHaveURL(/\/my-courses\/new\?recovery=[0-9a-f-]{36}$/);
  const recoveryUrl = stale.url();
  await expect(stale.getByLabel("코스 이름", { exact: true })).toHaveValue(
    "E2E 이전 탭 수정 · 복구",
  );
  await expect(stale.getByRole("combobox", { name: "내 코스 이동수단" })).toHaveValue("transit");
  await expect(stale.getByLabel("하루 출발 시간")).toHaveValue(copiedStart);
  await expect(stale.getByLabel("이 날짜 출발 시간", { exact: true })).toHaveValue("13:15");
  await expect(
    stale.locator(".personal-stop-list li").last().locator('input[type="time"]'),
  ).toHaveValue("18:00");
  await stale.getByLabel("편집할 날짜", { exact: true }).fill("2");
  await expect(stale.getByLabel("이 날짜 출발 시간", { exact: true })).toHaveValue("09:15");
  await stale.getByRole("textbox", { name: "여행 메모", exact: true }).fill("복구 후 이어 쓴 메모");
  await stale.getByRole("link", { name: "내 여행", exact: true }).click();
  await expect(stale).toHaveURL(/\/saved$/);
  await stale.goBack();
  await expect(stale).toHaveURL(recoveryUrl);
  await expect(stale.getByLabel("코스 이름", { exact: true })).toHaveValue(
    "E2E 이전 탭 수정 · 복구",
  );
  await expect(stale.getByRole("textbox", { name: "여행 메모", exact: true })).toHaveValue(
    "복구 후 이어 쓴 메모",
  );
  await stale.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(stale).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  const recoveredUrl = stale.url();
  expect(recoveredUrl).not.toBe(originalUrl);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("코스 이름", { exact: true })).toHaveValue("E2E 최신 변경");
  await stale.goto(originalUrl, { waitUntil: "domcontentloaded" });
  await expect(stale.getByLabel("코스 이름", { exact: true })).toHaveValue(
    "E2E 최신 버전의 미저장 편집",
  );
  await expect(
    stale.getByRole("button", { name: "이전 초안을 새 코스로 복구", exact: true }),
  ).toHaveCount(0);
  await stale.goto(recoveredUrl, { waitUntil: "domcontentloaded" });
  await stale.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await stale.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(stale).toHaveURL(/\/saved$/);
  await stale.close({ runBeforeUnload: false });
  await page.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
});

test("여행지 상세에서 기존 코스 날짜에 담고 이동수단·출발시간을 보존한다", async ({
  page,
  context,
}) => {
  await context.addCookies([await sessionCookie()]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/my-courses/new?spot=sokcho-market", { waitUntil: "domcontentloaded" });
  await page.getByLabel("코스 이름", { exact: true }).fill("E2E 기존 일정에 담기");
  await page.getByRole("combobox", { name: "내 코스 이동수단" }).selectOption("transit");
  await page.getByLabel("하루 출발 시간").fill("10:45");
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  const savedUrl = page.url();
  const courseId = new URL(savedUrl).pathname.split("/").at(-1)!;

  await page.goto("/spot/dongmyeong-port", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "내 코스에 담기", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/add\?spot=/);
  await expect(page.getByRole("heading", { name: "어느 코스에 담을까요?" })).toBeVisible();
  await page.getByRole("combobox", { name: "추가할 내 코스", exact: true }).selectOption(courseId);
  await page.getByRole("spinbutton", { name: "추가할 날짜", exact: true }).fill("2");
  await page.getByRole("button", { name: "이 코스에 1곳 담기", exact: true }).click();
  await expect(page).toHaveURL(savedUrl);
  await expect(page.getByRole("combobox", { name: "내 코스 이동수단" })).toHaveValue("transit");
  await expect(page.getByLabel("하루 출발 시간")).toHaveValue("10:45");
  await expect(page.locator(".personal-stop-list li")).toHaveCount(1);
  await page.getByRole("spinbutton", { name: "편집할 날짜", exact: true }).fill("2");
  await expect(page.locator(".personal-stop-list li")).toHaveCount(1);
  await expect(page.locator(".personal-stop-list")).toContainText("동명항");
  await page.locator(".route-leg-details summary").click();
  await expect(page.locator(".route-stop-list")).toContainText("10:45");

  // 같은 날짜에 중복 추가를 유도하지 않는다.
  await page.goto("/my-courses/add?spot=dongmyeong-port", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "추가할 내 코스", exact: true }).selectOption(courseId);
  await page.getByRole("spinbutton", { name: "추가할 날짜", exact: true }).fill("2");
  await expect(page.getByRole("status").filter({ hasText: "이미 모두 담겨" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "이 코스에 0곳 담기", exact: true }),
  ).toBeDisabled();
  await page.goto(savedUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
});

test("모바일에서 저장 전 코스를 떠나도 같은 탭으로 돌아와 초안을 이어간다", async ({
  page,
  context,
}) => {
  await context.addCookies([await sessionCookie()]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/my-courses/new?spot=sokcho-market", { waitUntil: "domcontentloaded" });
  await page.getByLabel("코스 이름", { exact: true }).fill("E2E 모바일 복원 여행");
  await page
    .getByRole("textbox", { name: "여행 메모", exact: true })
    .fill("예약 전에 동선부터 확인하기");
  await page.getByRole("combobox", { name: "내 코스 이동수단" }).selectOption("walk");
  await page.getByLabel("하루 출발 시간").fill("11:15");
  await page.getByRole("tab", { name: "+ 장소 추가", exact: true }).click();
  await expect(page.getByRole("region", { name: "내 코스 일정", exact: true })).not.toBeVisible();
  await page.getByRole("searchbox", { name: "내 코스 여행지 검색" }).fill("박수근미술관");
  await page.getByRole("button", { name: "박수근미술관 추가", exact: true }).click();
  await page.getByRole("combobox", { name: "추가할 장소 종류", exact: true }).selectOption("eat");
  await page.getByRole("searchbox", { name: "내 코스 여행지 검색" }).fill("강릉");
  const restaurant = page
    .locator(".personal-search-results article")
    .filter({
      has: page.getByRole("link", {
        name: "카카오맵 · 영업·예약 정보 (외부 사이트, 새 탭에서 열림)",
        exact: true,
      }),
    })
    .first();
  await expect(restaurant).toBeVisible();
  await expect(
    restaurant.getByRole("link", {
      name: "카카오맵 · 영업·예약 정보 (외부 사이트, 새 탭에서 열림)",
      exact: true,
    }),
  ).toHaveAttribute("href", /map\.kakao\.com/);
  const restaurantName = await restaurant.locator("strong").innerText();
  await restaurant.getByRole("button", { name: `${restaurantName} 추가`, exact: true }).click();
  await expect(page.locator(".mobile-plan-save")).toContainText("3곳");
  await expect(page.locator(".mobile-plan-save")).toContainText("이 탭에 임시 저장됨");
  await page.getByRole("tab", { name: /^일정/ }).click();
  await expect(page.locator(".personal-stop-list li")).toHaveCount(3);

  // Link로 다른 앱 화면에 간 뒤 뒤로 돌아오는 SPA 이동을 검증한다.
  await page.getByRole("link", { name: "내 여행", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("link", { name: /E2E 모바일 복원 여행/ })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/my-courses\/new\?spot=sokcho-market/);
  await expect(
    page.getByRole("status").filter({ hasText: "초안을 이어서 불러왔어요" }),
  ).toBeVisible();
  await expect(page.getByLabel("코스 이름", { exact: true })).toHaveValue("E2E 모바일 복원 여행");
  await expect(page.getByRole("textbox", { name: "여행 메모", exact: true })).toHaveValue(
    "예약 전에 동선부터 확인하기",
  );
  await expect(page.getByRole("combobox", { name: "내 코스 이동수단" })).toHaveValue("walk");
  await expect(page.getByLabel("하루 출발 시간")).toHaveValue("11:15");
  await expect(page.locator(".personal-stop-list")).toContainText(restaurantName);
  await expect(page.locator(".personal-stop-list li")).toHaveCount(3);
  await page.getByRole("button", { name: "내 코스 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/my-courses\/[0-9a-f-]{36}$/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".personal-stop-list li")).toHaveCount(3);
  await expect(page.getByLabel("하루 출발 시간")).toHaveValue("11:15");
  await expect(page.locator(".personal-stop-list")).toContainText(restaurantName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole("button", { name: "이 코스 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
});
