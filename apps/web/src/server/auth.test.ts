import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatedNickname } from "./auth-nickname";

const mocks = vi.hoisted(() => ({
  config: null as NextAuthConfig | null,
  getDb: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("next-auth", () => ({
  default: (config: NextAuthConfig) => {
    mocks.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("@/lib/env", () => ({
  assertProductionEnv: vi.fn(),
  env: {},
  isProductionRuntime: false,
  requireEnv: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./db/user-data", () => ({ fetchUserProfile: mocks.profile }));
await import("./auth");

const callbacks = () => mocks.config!.callbacks!;
async function sessionFor(token: JWT) {
  const session = { user: { name: "이전 실명" }, expires: "2099-01-01" } as Session;
  const callback = callbacks().session!;
  return await callback({ session, token } as Parameters<typeof callback>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockReturnValue({ testDb: true });
  mocks.profile.mockResolvedValue(null);
});

describe("인증 세션의 닉네임과 소유권", () => {
  it("신규 소셜 로그인의 full name은 저장하지 않고 subject와 서버 토큰은 유지한다", async () => {
    const callback = callbacks().jwt!;
    const token = await callback({
      token: { name: "김실명", email: "real@example.com" },
      profile: { sub: "owner-a", name: "김실명", nickname: "바다산책" },
      account: {
        access_token: "private-access",
        id_token: "private-id",
        refresh_token: "private-refresh",
        expires_at: 9999999999,
      },
    } as Parameters<typeof callback>[0]);
    expect(token).toMatchObject({
      sub: "owner-a",
      name: "바다산책",
      nickname: "바다산책",
      email: "real@example.com",
      accessToken: "private-access",
      idToken: "private-id",
    });
  });

  it("기존 JWT도 세션 갱신 때 실명 대신 안정적인 별명으로 전환한다", async () => {
    const callback = callbacks().jwt!;
    const token = await callback({
      token: { sub: "owner-a", name: "김실명", accessTokenExpiresAt: 9999999999 },
    } as Parameters<typeof callback>[0]);
    expect(token?.name).toBe(generatedNickname("owner-a"));
    expect((await sessionFor(token!)).user?.name).toBe(generatedNickname("owner-a"));
  });

  it("DB에 저장한 닉네임은 로그인 별명보다 우선하며 요청한 계정의 값만 읽는다", async () => {
    mocks.profile.mockImplementation(async (_db, userId: string) => ({
      displayName: userId === "owner-a" ? "나만의별명" : "다른여행자",
    }));
    expect((await sessionFor({ sub: "owner-a", nickname: "IdP별명" })).user).toMatchObject({
      id: "owner-a",
      name: "나만의별명",
    });
    expect((await sessionFor({ sub: "owner-b", nickname: "IdP별명" })).user).toMatchObject({
      id: "owner-b",
      name: "다른여행자",
    });
    expect(mocks.profile.mock.calls.map((call) => call[1])).toEqual(["owner-a", "owner-b"]);
  });

  it("DB 장애로 인증을 실패시키거나 실명·서버 토큰을 클라이언트에 노출하지 않는다", async () => {
    mocks.profile.mockRejectedValue(new Error("DB unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const session = await sessionFor({
        sub: "owner-a",
        name: "김실명",
        roles: ["member"],
        accessToken: "private-access",
        idToken: "private-id",
        refreshToken: "private-refresh",
      });
      expect(session.user).toMatchObject({
        id: "owner-a",
        name: generatedNickname("owner-a"),
        roles: ["member"],
      });
      expect(JSON.stringify(session)).not.toContain("private-");
      expect(JSON.stringify(session)).not.toContain("김실명");
    } finally {
      warn.mockRestore();
    }
  });

  it("subject 없는 세션은 사용자 DB를 조회하지 않는다", async () => {
    expect((await sessionFor({ name: "김실명" })).user?.name).toBe("여행자");
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
