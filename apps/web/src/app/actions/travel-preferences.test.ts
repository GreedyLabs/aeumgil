import { beforeEach, describe, expect, it, vi } from "vitest";
import { setOnboardingPreferenceAction } from "./onboarding";
import { updateProfileAction } from "./profile";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getDb: vi.fn(),
  setPreference: vi.fn(),
  setProfile: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/server/db/user-data", () => ({
  setOnboardingPreference: mocks.setPreference,
  setUserProfile: mocks.setProfile,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const db = { test: true };
const input = { interestThemeIds: ["topic:sea"], paceId: "balanced", companionId: "family" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "session-owner" } });
  mocks.getDb.mockReturnValue(db);
  mocks.setPreference.mockResolvedValue(undefined);
  mocks.setProfile.mockResolvedValue(undefined);
});

describe("여행 취향 Server Action", () => {
  it("세션 소유자의 실제 저장 포트에만 전달한다", async () => {
    expect(await setOnboardingPreferenceAction(input)).toEqual({ ok: true });
    expect(mocks.setPreference).toHaveBeenCalledWith(db, "session-owner", input);
    expect(mocks.revalidate).toHaveBeenCalledWith("/result", "page");
    expect(mocks.revalidate).toHaveBeenCalledWith("/course/[id]", "page");
  });
  it("미로그인 요청은 쓰지 않는다", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await setOnboardingPreferenceAction(input)).toMatchObject({ ok: false });
    expect(mocks.setPreference).not.toHaveBeenCalled();
  });
  it("허용하지 않은 관심 분야·스타일을 저장하지 않는다", async () => {
    expect(
      await setOnboardingPreferenceAction({ ...input, interestThemeIds: ["legacy-or-fake"] }),
    ).toMatchObject({ ok: false });
    expect(await setOnboardingPreferenceAction({ ...input, paceId: "anything" })).toMatchObject({
      ok: false,
    });
    expect(mocks.setPreference).not.toHaveBeenCalled();
  });
  it("선택 비우기는 빈 설정으로 저장한다", async () => {
    const cleared = { interestThemeIds: [], paceId: "", companionId: "" };
    expect(await setOnboardingPreferenceAction(cleared)).toEqual({ ok: true });
    expect(mocks.setPreference).toHaveBeenCalledWith(db, "session-owner", cleared);
  });
  it("DB 쓰기가 실패하면 성공·재검증으로 처리하지 않는다", async () => {
    mocks.setPreference.mockRejectedValue(new Error("DB unavailable"));
    expect(await setOnboardingPreferenceAction(input)).toMatchObject({ ok: false });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("프로필만 편집해도 임의의 여행 취향을 생성하거나 덮어쓰지 않는다", async () => {
    expect(await updateProfileAction({ displayName: "여행자", bio: "소개" })).toEqual({ ok: true });
    expect(mocks.setProfile).toHaveBeenCalledWith(db, "session-owner", {
      displayName: "여행자",
      bio: "소개",
    });
    expect(mocks.setPreference).not.toHaveBeenCalled();
  });
});
