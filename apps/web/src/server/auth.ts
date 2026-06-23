// ─────────────────────────────────────────────
// Auth.js (NextAuth v5) 설정 — 서버 전용.
//
// - 어댑터: Drizzle(PostgreSQL) — 세션/계정/유저를 DB에 영속.
// - 세션 전략: database (어댑터 세션 테이블 사용).
// - 제공자: 카카오 · 네이버 · 구글 · 애플.
//     각 제공자는 환경변수 규약으로 키를 읽는다:
//       AUTH_KAKAO_ID / AUTH_KAKAO_SECRET
//       AUTH_NAVER_ID / AUTH_NAVER_SECRET
//       AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
//       AUTH_APPLE_ID / AUTH_APPLE_SECRET (애플은 client secret 이 JWT — 발급 필요)
//   + AUTH_SECRET(세션 암호화), AUTH_URL(콜백 베이스)
//
// 이번 슬라이스는 골격까지 — 로그인 플로우/세션 저장은 동작하되, 화면(app-shell)의
// mock 인증 대체와 saved/reviews/visits 영속 연결은 다음 슬라이스.
// ─────────────────────────────────────────────

import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Naver from "next-auth/providers/naver";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { accounts, sessions, users, verificationTokens } from "./db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  // 로컬/비-Vercel 환경에서 호스트 신뢰(개발 편의). 프로덕션은 AUTH_URL 로 고정.
  trustHost: true,
  providers: [Kakao, Naver, Google, Apple],
});
