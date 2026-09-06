import { expect, test } from "@playwright/test";
import { sessionCookie, TEST_USER } from "./helpers/session";

for (const width of [390, 1440]) {
  test(`${width}px 회원 화면에서 기록·취향·설정 흐름과 폼 레이아웃이 동작한다`, async ({
    page,
    context,
  }) => {
    await context.addCookies([await sessionCookie()]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: /^여행자-[a-f0-9]{8} · 내 여행$/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: "프로필 편집", exact: true }).click();
    await expect(page).toHaveURL(/\/profile\/edit/);
    for (const route of [
      "/profile/edit",
      "/reviews",
      "/reviews?tab=visits",
      "/settings",
      "/onboarding",
    ]) {
      await page.goto(route);
      await expect(page.locator(".screen-body")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        route,
      ).toBe(false);
    }
    await page.goto("/profile");
    await page.getByRole("link", { name: "여행 취향 설정" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });
}

for (const width of [390, 1440]) {
  test(`${width}px 여행 취향을 저장·복원하고 검색 및 코스 기본값에 반영한다`, async ({
    page,
    context,
  }) => {
    await context.addCookies([await sessionCookie()]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "나에게 맞는 여행의 기본값" })).toBeVisible();
    const interests = page.getByRole("group", { name: "관심 있는 여행" });
    await expect(interests.getByRole("button")).toHaveCount(10);
    const sea = interests.getByRole("button", { name: /바다·해변/ });
    await expect(sea).toBeEnabled();
    const clear = page.getByRole("button", { name: "선택 비우기", exact: true });
    if (await clear.isEnabled()) await clear.click();
    await page
      .locator(".screen-enter")
      .evaluate((element) =>
        Promise.all(element.getAnimations().map((animation) => animation.finished)),
      );
    const before = await sea.boundingBox();
    await sea.click();
    await expect(sea).toHaveAttribute("aria-pressed", "true");
    expect(await sea.boundingBox()).toEqual(before);
    await page.getByRole("combobox", { name: "여행 페이스", exact: true }).selectOption("active");
    await page
      .getByRole("combobox", { name: "주로 함께 여행하는 사람", exact: true })
      .selectOption("solo");
    await page.getByRole("button", { name: "여행 취향 저장", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "다음 검색과 추천 코스" }),
    ).toBeVisible();
    await page.reload();
    await expect(sea).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", { name: "여행 페이스", exact: true })).toHaveValue(
      "active",
    );
    await expect(
      page.getByRole("combobox", { name: "주로 함께 여행하는 사람", exact: true }),
    ).toHaveValue("solo");
    await page.goto("/profile/edit");
    await expect(page.getByRole("textbox", { name: "닉네임", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page).not.toHaveURL(/\/profile\/edit/);
    await page.goto("/profile");
    await expect(page.getByText("페이스 · 활동적", { exact: true })).toBeVisible();
    await expect(page.getByText("동행 · 혼자", { exact: true })).toBeVisible();
    await page.goto(`/result?q=${encodeURIComponent("강릉 여행")}`);
    await expect(
      page.getByText("입력 조건이 같은 후보에서는 저장한 관심 분야를 참고했어요."),
    ).toBeVisible();
    await page.getByRole("link", { name: "이 조건으로 코스 보기" }).click();
    await expect(
      page
        .locator(".course-note")
        .filter({ hasText: "저장한 여행 취향(활동적 페이스 · 혼자 여행)" }),
    ).toBeVisible();
    const explicit = new URL(page.url());
    explicit.searchParams.set("pace", "calm");
    explicit.searchParams.set("companion", "family");
    await page.goto(explicit.toString());
    await expect(page.locator(".page-heading")).toContainText("여유");
    await expect(page.locator(".course-note").filter({ hasText: "저장한 여행 취향" })).toHaveCount(
      0,
    );
    await page.goto("/onboarding");
    await expect(clear).toBeEnabled();
    await clear.click();
    await page.getByRole("button", { name: "여행 취향 저장", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "다음 검색과 추천 코스" }),
    ).toBeVisible();
    await page.reload();
    await expect(interests.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "여행 페이스", exact: true })).toHaveValue("");
    await expect(
      page.getByRole("combobox", { name: "주로 함께 여행하는 사람", exact: true }),
    ).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
  });
}

// 소셜 제공자의 실제 왕복이 아닌, 이전 full name이 든 세션 픽스처로 앱 저장 경로를 검증한다.
test("닉네임을 저장하면 프로필·공통 메뉴·세션에 반영되고 새 로그인에도 복원한다", async ({
  page,
  context,
}) => {
  const nickname = "설악길 산책자";
  const bio = "느긋하게 강원의 골목을 걸어요.";
  await context.addCookies([await sessionCookie()]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: /^여행자-[a-f0-9]{8} · 내 여행$/ })).toBeVisible();
  await page.getByRole("link", { name: "프로필 편집", exact: true }).click();
  await page.getByRole("textbox", { name: "닉네임", exact: true }).fill(nickname);
  await page.getByRole("textbox", { name: "한 줄 소개", exact: true }).fill(bio);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: `${nickname} · 내 여행`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${nickname} · 내 정보`, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".profile-overview")).toContainText(bio);
  const updatedSession = await page.request.get("/api/auth/session");
  expect(updatedSession.ok()).toBe(true);
  expect(await updatedSession.json()).toMatchObject({ user: { id: TEST_USER.id, name: nickname } });

  // 새 쿠키는 여전히 기존 full name만 담는다. 표시명이 유지되면 앱 DB에서 복원한 것이다.
  await context.addCookies([await sessionCookie()]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: `${nickname} · 내 여행`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${nickname} · 내 정보`, exact: true }),
  ).toBeVisible();
  const restoredSession = await page.request.get("/api/auth/session");
  expect(restoredSession.ok()).toBe(true);
  expect(await restoredSession.json()).toMatchObject({
    user: { id: TEST_USER.id, name: nickname },
  });
  await page.getByRole("link", { name: "프로필 편집", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "닉네임", exact: true })).toHaveValue(nickname);
  await expect(page.getByRole("textbox", { name: "한 줄 소개", exact: true })).toHaveValue(bio);
});
