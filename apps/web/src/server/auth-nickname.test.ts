import { describe, expect, it } from "vitest";
import { generatedNickname, nicknameFromClaims, nicknameFromToken } from "./auth-nickname";

describe("소셜 로그인 별명", () => {
  it("실명이나 이메일 대신 제공된 닉네임을 사용한다", () => {
    expect(
      nicknameFromClaims({
        sub: "user-a",
        nickname: "  바다산책  ",
        name: "김실명",
        email: "real@example.com",
      }),
    ).toBe("바다산책");
  });

  it("실명·이메일과 구별되는 짧은 사용자명은 별명으로 사용할 수 있다", () => {
    expect(
      nicknameFromClaims({
        sub: "user-a",
        preferred_username: "forest_walker",
        name: "Kim Real",
        email: "real@example.com",
      }),
    ).toBe("forest_walker");
    expect(
      nicknameFromClaims({
        sub: "user-a",
        preferred_username: "홍길동",
        given_name: "길동",
        family_name: "홍",
      }),
    ).toBe(generatedNickname("user-a"));
    expect(nicknameFromClaims({ sub: "user-a", preferred_username: "real＠example.com" })).toBe(
      generatedNickname("user-a"),
    );
  });

  it.each([
    { preferred_username: "real@example.com" },
    { preferred_username: "real", email: "real@example.com" },
    { preferred_username: "Kim Real", name: "Kim Real" },
    { preferred_username: "kim.real", given_name: "Kim", family_name: "Real" },
    { preferred_username: "Kim", given_name: "Kim" },
    { nickname: "real@example.com" },
    { nickname: "숨긴\u202e이름" },
    { nickname: "너무긴이름".repeat(10) },
  ])("개인정보·비정상 표시명은 sub 기반 별명으로 대체한다: %j", (profile) => {
    expect(nicknameFromClaims({ sub: "user-a", ...profile })).toBe(generatedNickname("user-a"));
  });

  it("별명은 같은 계정에서 일정하고 이메일·실명 변경에 영향받지 않는다", () => {
    const nickname = generatedNickname("known-subject-a");
    expect(nickname).toMatch(/^여행자-[0-9a-f]{8}$/);
    expect(nickname).not.toContain("known-subject");
    expect(
      nicknameFromClaims({ sub: "known-subject-a", name: "김실명", email: "first@example.com" }),
    ).toBe(nickname);
    expect(
      nicknameFromClaims({ sub: "known-subject-a", name: "다른이름", email: "second@example.com" }),
    ).toBe(nickname);
    expect(generatedNickname("known-subject-b")).not.toBe(nickname);
  });

  it("구형 쿠키의 full name을 재사용하지 않고 검증된 별명만 읽는다", () => {
    const legacy = { sub: "user-a", name: "김실명", email: "real@example.com" };
    expect(nicknameFromToken(legacy)).toBe(generatedNickname("user-a"));
    expect(nicknameFromToken({ ...legacy, nickname: "강원여행자" })).toBe("강원여행자");
  });
});
