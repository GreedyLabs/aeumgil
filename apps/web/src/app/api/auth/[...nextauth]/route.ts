// Auth.js 라우트 핸들러 — /api/auth/* (signin/callback/signout/session 등).
// 설정은 server/auth.ts 에 모아두고 여기선 핸들러만 노출.
import { handlers } from "@/server/auth";

export const { GET, POST } = handlers;
