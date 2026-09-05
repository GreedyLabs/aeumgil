import { describe, it, expect, vi, afterEach } from "vitest";
import { encode } from "next-auth/jwt";
const config = vi.hoisted(() => ({
  AUTH_SECRET: "logout-test-secret",
  AUTH_URL: "http://localhost:3000",
}));
vi.mock("@/lib/env", () => ({ env: config }));
import { readSessionToken } from "./session-token";

afterEach(() => {
  config.AUTH_URL = "http://localhost:3000";
});
describe("로그아웃 세션 쿠키", () => {
  it.each([false, true])("HTTPS=%s 쿠키에서 ID 토큰을 읽는다", async (secure) => {
    config.AUTH_URL = secure ? "https://xn--wk0bk16buua.xn--3e0b707e" : "http://localhost:3000";
    const name = `${secure ? "__Secure-" : ""}authjs.session-token`;
    const value = await encode({
      salt: name,
      secret: config.AUTH_SECRET,
      token: { sub: "test", idToken: "oidc-id-token" },
    });
    const token = await readSessionToken(
      new Headers({ cookie: `${name}=${value}`, host: "localhost:3000" }),
    );
    expect(token?.idToken).toBe("oidc-id-token");
  });
  it("HTTPS 프록시에서 분할된 큰 세션 쿠키도 복원한다", async () => {
    config.AUTH_URL = "https://example.com";
    const name = "__Secure-authjs.session-token";
    const value = await encode({
      salt: name,
      secret: config.AUTH_SECRET,
      token: { idToken: "long".repeat(1500) },
    });
    const cookie = `${name}.0=${value.slice(0, 3000)}; ${name}.1=${value.slice(3000)}`;
    expect((await readSessionToken(new Headers({ cookie })))?.idToken).toBe("long".repeat(1500));
  });
  it("없거나 훼손된 세션은 토큰을 만들지 않는다", async () => {
    expect(await readSessionToken(new Headers())).toBeNull();
    expect(
      await readSessionToken(new Headers({ cookie: "authjs.session-token=broken" })),
    ).toBeNull();
  });
});
