import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { sessionCookie, TEST_USER } from "./helpers/session";

type Language = "ko" | "en" | "zh-CN" | "zh-TW" | "ja" | "de" | "fr";
const languageCases: { lang: Language; query: string; titlePattern: RegExp }[] = [
  { lang: "ko", query: "속초 바다 시장", titlePattern: /[가-힣]/ },
  { lang: "en", query: "Sokcho beach market", titlePattern: /[a-z]/i },
  { lang: "zh-CN", query: "束草 海边 市场", titlePattern: /[天夜]/ },
  { lang: "zh-TW", query: "束草 海邊 市場", titlePattern: /[天夜]/ },
  { lang: "ja", query: "束草 海辺 市場", titlePattern: /[泊日]/ },
  { lang: "de", query: "Sokcho Strand Markt", titlePattern: /\bTage[n]?\b/ },
  { lang: "fr", query: "Sokcho plage marché", titlePattern: /\bjours\b/ },
];

const languagePicker = (page: Page) => page.locator(".desktop-nav").getByRole("combobox");
async function expectLanguage(page: Page, context: BrowserContext, lang: Language) {
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
  await expect(languagePicker(page)).toHaveValue(lang);
  await expect
    .poll(
      async () =>
        (await context.cookies(page.url())).find((cookie) => cookie.name === "eumgil.lang")?.value,
    )
    .toBe(lang);
}
async function selectLanguage(page: Page, context: BrowserContext, lang: Language) {
  await languagePicker(page).selectOption(lang);
  await expectLanguage(page, context, lang);
}

for (const { lang, query, titlePattern } of languageCases) {
  test(`${lang}: 홈 언어 선택은 새로고침·테마 제목·Enter 검색에서도 유지된다`, async ({
    page,
    context,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // 기본 한국어에서도 실제 선택 동작으로 쿠키를 생성해 복귀 경로를 확인한다.
    if (lang === "ko") await selectLanguage(page, context, "en");
    await selectLanguage(page, context, lang);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectLanguage(page, context, lang);

    const titles = page.locator(".home-page .theme-card-title h3");
    await expect(titles).toHaveCount(3);
    // 추천 순환 때문에 특정 첫 카드 ID·노출 순서를 고정하지 않는다.
    for (let index = 0; index < 3; index++) {
      await expect(titles.nth(index)).toContainText(titlePattern);
      if (lang !== "ko") await expect(titles.nth(index)).not.toContainText(/[가-힣]/);
    }
    const input = page.locator(".intent-search input");
    await expect(input).toBeEnabled();
    await input.fill(query);
    await input.press("Enter");
    await expect(page).toHaveURL(
      (url) => url.pathname === "/result" && url.searchParams.get("q") === query,
    );
    await expect(page.locator('.match-primary a[href^="/course/"]')).toBeVisible();
    await expect(page.locator(".match-keywords .chip").first()).toBeVisible();
    await expectLanguage(page, context, lang);
    expect(pageErrors, "언어 변경 및 검색 중 hydration·브라우저 오류가 없어야 한다").toEqual([]);
  });
}

// 공식 TourAPI 외국어 이름이 실제 검색 및 국문 정본 연결에 반영되는 통합 검사다.
// 원천 장애를 번역 성공으로 간주하거나 skip하지 않는다. 사진·날씨 수치는 고정하지 않는다.
for (const sample of [
  {
    lang: "fr" as const,
    query: "Musée Park Soo Keun",
    title: /Musée Park Soo Keun/,
    canonicalId: "tour-130493",
  },
  {
    lang: "de" as const,
    query: "Strand Sokcho",
    title: /Strand Sokcho/,
    canonicalId: "tour-125707",
  },
]) {
  test(`${sample.lang}: 공식 외국어 장소명으로 검색하고 정본 ID의 상세로 이동한다`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/discover?tab=places", { waitUntil: "domcontentloaded" });
    await selectLanguage(page, context, sample.lang);
    // 언어 변경의 RSC 전환 중에는 숨겨진 이전 화면이 잠시 남을 수 있다.
    const search = page.locator('.places-search:visible input[type="search"]:enabled');
    await expect(search).toBeEnabled();
    await search.fill(sample.query);
    await expect(page).toHaveURL(
      (url) => url.pathname === "/discover" && url.searchParams.get("q") === sample.query,
    );
    const card = page.locator(".place-card:visible").filter({
      has: page.locator(`.place-card-actions a[href="/spot/${sample.canonicalId}"]`),
    });
    const detail = card.locator(`.place-card-actions a[href="/spot/${sample.canonicalId}"]`);
    await expect(card).toHaveCount(1, { timeout: 30_000 });
    await expect(card.locator(".place-card-title")).toContainText(sample.title);
    await card.locator(".place-card-select").click();
    await expect(page).toHaveURL((url) => url.pathname === "/discover");
    await expect(card).toHaveClass(/is-selected/);
    await expect(page.locator(".places-map-heading:visible h2")).toContainText(sample.title);
    await detail.click();
    await expect(page).toHaveURL((url) => url.pathname === `/spot/${sample.canonicalId}`);
    await expect(page.locator(".spot-page h1")).toContainText(sample.title, { timeout: 30_000 });
    await expect(page.locator(".translation-notice")).toContainText("Korea Tourism Organization");
    await expectLanguage(page, context, sample.lang);
  });
}

interface DraftContent {
  title: string;
  startDate?: string;
  endDate?: string;
  items: { refId: string; day: number; durationMin: number }[];
}
async function storedDraft(page: Page): Promise<DraftContent | null> {
  return page.evaluate((prefix) => {
    const key = Object.keys(sessionStorage).find(
      (key) => key.startsWith(prefix) && !key.endsWith(":older"),
    );
    if (!key) return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).draft ?? null;
  }, `eumgil.draft:${TEST_USER.id}:`);
}

test("지연된 장소 검색 중 언어를 바꿔도 새 검색과 개인 코스 초안을 보존한다", async ({
  page,
  context,
}) => {
  await context.addCookies([await sessionCookie()]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/my-courses/new?spot=sokcho-market", { waitUntil: "domcontentloaded" });
  const title = "E2E 언어 전환 초안";
  await page.getByLabel("코스 이름", { exact: true }).fill(title);
  await page.getByLabel("여행 시작일", { exact: true }).fill("2028-02-28");
  await page.getByLabel("여행 종료일", { exact: true }).fill("2028-03-06");
  await expect(page.locator(".personal-stop-list li")).toHaveCount(1);
  await expect
    .poll(async () => {
      const draft = await storedDraft(page);
      return { title: draft?.title, startDate: draft?.startDate, endDate: draft?.endDate };
    })
    .toEqual({ title, startDate: "2028-02-28", endDate: "2028-03-06" });
  const before = await storedDraft(page);
  expect(before?.items[0]?.refId).toBe("sokcho-market");
  expect(before?.startDate).toBe("2028-02-28");
  expect(before?.endDate).toBe("2028-03-06");

  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delayed = false;
  const requestLanguages: string[] = [];
  await page.route("**/my-courses/new**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      const headers = await request.allHeaders();
      // 인증 쿠키나 요청 본문을 보관하지 않고 언어 쿠키 값만 확인한다.
      requestLanguages.push(
        /(?:^|;\s*)eumgil\.lang=([^;]+)/.exec(headers.cookie ?? "")?.[1] ?? "ko",
      );
      if (!delayed) {
        delayed = true;
        await gate;
      }
    }
    try {
      await route.continue();
    } catch (error) {
      // 언어 변경에서 이전 요청을 실제로 취소하는 구현도 정상이다.
      if (!page.isClosed() && !request.failure()?.errorText.includes("ERR_ABORTED")) throw error;
    }
  });
  try {
    await page
      .getByRole("searchbox", { name: "내 코스 여행지 검색", exact: true })
      .fill("박수근미술관");
    await expect.poll(() => delayed).toBe(true);
    await expect(page.locator(".personal-search-results")).toHaveAttribute("aria-busy", "true");
    await selectLanguage(page, context, "fr");
    await expect(
      page.getByRole("searchbox", { name: "Chercher des lieux pour mon voyage", exact: true }),
    ).toHaveValue("박수근미술관");
    // Next의 Server Action은 직렬화될 수 있으므로 이전 응답을 해제한 뒤 새 언어의 완료를 검사한다.
    release();
    await expect.poll(() => requestLanguages.includes("fr")).toBe(true);
    const results = page.locator(".personal-search-results");
    await expect(results.locator("strong").filter({ hasText: /Musée Park Soo Keun/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(results).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".personal-stop-list li")).toHaveCount(1);
    await expect(page.getByLabel("Nom du voyage", { exact: true })).toHaveValue(title);
    await expect(page.getByLabel("Date de début", { exact: true })).toHaveValue("2028-02-28");
    await expect(page.getByLabel("Date de fin", { exact: true })).toHaveValue("2028-03-06");
    expect(await storedDraft(page)).toEqual(before);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }

  // 저장 버튼을 누르지 않는다. 같은 탭을 새로고침해 임시 초안 복구까지 확인한다.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectLanguage(page, context, "fr");
  await expect(page.getByLabel("Nom du voyage", { exact: true })).toHaveValue(title);
  await expect(page.getByLabel("Date de début", { exact: true })).toHaveValue("2028-02-28");
  await expect(page.getByLabel("Date de fin", { exact: true })).toHaveValue("2028-03-06");
  await expect(page.locator(".personal-stop-list li")).toHaveCount(1);
  expect(await storedDraft(page)).toEqual(before);
  await expect(page).toHaveURL((url) => url.pathname === "/my-courses/new");
});
