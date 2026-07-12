// §8.1 시나리오 1 — 홈 → 자연어 입력 → /result 매칭 → 테마 → 코스(타임라인 렌더).
// 매칭은 서버(키워드 규칙/에이전트)에서 일어나고, /result 는 애니메이션 후
// router.replace 로 테마에 진입한다(§6.3 — 뒤로가기 루프 방지도 함께 확인).

import { expect, test } from "@playwright/test";

test("홈에서 자연어로 코스까지 도달한다", async ({ page }) => {
  await page.goto("/");

  const input = page.getByPlaceholder("예) 조용한 여행");
  await input.fill("바다 보고 힐링");
  await input.press("Enter");

  // 매칭 애니메이션(~3s) 후 테마로 replace — 바다/힐링 → 동해 계열 테마 기대(§6.3 회귀)
  await page.waitForURL(/\/theme\//, { timeout: 60_000 });
  await expect(page).toHaveURL(/east-sea|healing|sunrise/);

  await page.getByText("코스 자세히 보기").click();
  await page.waitForURL(/\/course\//, { timeout: 60_000 });

  // 타임라인 렌더: 시간 표기(HH:MM) 항목이 1개 이상 + 저장 CTA 노출
  await expect(page.getByText(/^\d{2}:\d{2}$/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /내 여행에 저장|저장 해제/ })).toBeVisible();

  // §6.3 회귀: 코스→뒤로가기→테마→뒤로가기 시 /result 재진입("조회중" 루프) 없이 홈으로
  await page.goBack(); // → theme
  await page.goBack(); // → home (result 는 replace 로 대체됐어야 함)
  await expect(page).toHaveURL(/\/$|\/\?/);
});
