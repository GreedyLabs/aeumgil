import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  signOut: vi.fn(),
  destination: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/session-token", () => ({ readSessionToken: mocks.read }));
vi.mock("@/server/auth", () => ({
  signOut: mocks.signOut,
  keycloakEndSessionUrl: mocks.destination,
}));
import { logoutAction } from "./logout";
it("ID 토큰 확보 → 앱 세션 종료 → Keycloak 로그아웃으로 이어진다", async () => {
  mocks.read.mockResolvedValue({ idToken: "session-id" });
  mocks.destination.mockReturnValue("https://auth.example/logout?id_token_hint=session-id");
  await logoutAction();
  expect(mocks.destination).toHaveBeenCalledWith("session-id");
  expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
  expect(mocks.redirect).toHaveBeenCalledWith(
    "https://auth.example/logout?id_token_hint=session-id",
  );
  expect(mocks.read.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.signOut.mock.invocationCallOrder[0]!,
  );
  expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.redirect.mock.invocationCallOrder[0]!,
  );
});
