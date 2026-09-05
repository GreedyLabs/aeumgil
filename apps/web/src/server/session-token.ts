import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";

/** 프록시 내부 HTTP 주소가 아니라 Auth.js의 공개 URL과 동일한 쿠키 이름을 사용한다. */
export function readSessionToken(headers: Headers) {
  return getToken({
    req: { headers },
    secret: env.AUTH_SECRET || "eumgil-dev-only-auth-secret-change-before-production",
    secureCookie: new URL(env.AUTH_URL || "http://localhost:3000").protocol === "https:",
  });
}
