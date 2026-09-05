// §8.1 시나리오 4 — (로그인 픽스처) 코스 저장 토글 → /saved 반영.
// global-setup 이 테스트 사용자 데이터를 지우므로 항상 "미저장" 상태에서 시작한다.

import { expect, test } from "@playwright/test";
import { sessionCookie } from "./helpers/session";

test("로그인 상태에서 저장 토글이 saved 화면에 반영된다", async ({ page, context }) => {
  await context.addCookies([await sessionCookie()]);

  await page.goto("/course/east-sea-sunrise");
  await page
    .getByRole("button", { name: "테마 보관", exact: true })
    .first()
    .click({ timeout: 60_000 });
  // 토스트 = 서버 액션 await 성공(DB 커밋) 신호.
  await expect(page.getByText("내 여행에 테마를 보관했어요")).toBeVisible();
  // revalidatePath 가 현재 코스 페이지 RSC 갱신을 계속 진행하므로(30s+),
  // 그 동안 page.goto 를 하면 갱신과 경합해 ERR_ABORTED 가 난다.
  // 버튼이 "저장 해제"로 바뀌는 것(= transition 완료)을 기다린 뒤 이동한다.
  await expect(
    page.getByRole("button", { name: "테마 보관 해제", exact: true }).first(),
  ).toBeVisible({
    timeout: 60_000,
  });

  await page.goto("/saved");
  await expect(page.getByRole("region", { name: "저장한 추천 테마" })).toBeVisible();
  // global-setup 이 데이터를 비우므로 이번 저장 1건만 존재해야 한다.
  // 카드는 테마의 대표 코스 제목("동해안 일출·드라이브 …")을 표시한다.
  await expect(page.getByRole("heading", { name: "저장한 추천 테마 1" })).toBeVisible();
  await expect(page.getByText(/동해안 일출|동해 일출/).first()).toBeVisible();
  // 저장 일자(YYYY-MM-DD, §4.3) 표기 확인
  await expect(page.getByText(/\d{4}-\d{2}-\d{2}/).first()).toBeVisible();
});
