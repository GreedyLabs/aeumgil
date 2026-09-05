import { expect, test } from "@playwright/test";

const start = "/realms/eumgil-preview/account/";

for (const width of [320, 390, 768, 1440]) {
  test(`${width}px 실제 Keycloak에서 로그인·회원가입·재설정 테마가 동작한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(start);
    await expect(page.getByRole("heading", { name: "여행을 이어갈까요?" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    await expect(page.getByRole("link", { name: "이용약관", exact: true })).toHaveAttribute(
      "href",
      "http://localhost:3000/doc?type=terms",
    );
    await page.getByRole("link", { name: "회원가입", exact: true }).click();
    await expect(page.getByRole("heading", { name: "에움길과 함께 시작해요" })).toBeVisible();
    await expect(page.getByLabel(/비밀번호 확인/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    await page.goto(start);
    await page.getByRole("link", { name: "비밀번호를 잊으셨나요?" }).click();
    await expect(page.getByRole("heading", { name: "비밀번호 재설정" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
  });
}

test("인증 오류를 표시하고 정상 계정으로 로그인할 수 있다", async ({ page }) => {
  await page.goto(start);
  await page.getByRole("textbox", { name: "아이디 또는 이메일", exact: true }).fill("demo");
  await page.getByLabel("비밀번호", { exact: true }).fill("incorrect-preview-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByText("아이디 또는 비밀번호를 확인해 주세요.").first()).toBeVisible();
  await page.getByLabel("비밀번호", { exact: true }).fill("demo-preview-only");
  await page.getByRole("button", { name: "비밀번호 보기", exact: true }).click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/realms\/eumgil-preview\/account\//);
  await expect(page.locator("#kc-form-login")).toHaveCount(0);
});
