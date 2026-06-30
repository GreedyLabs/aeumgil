// ─────────────────────────────────────────────
// Vitest 설정 — 단위 테스트(순수 함수) 중심.
//
// 현재 단계(①): 도메인/서버 순수 함수 테스트만 → 환경 "node", 외부 플러그인 불필요.
// `@/` 별칭은 tsconfig 와 동일하게 ./src 로 직접 매핑한다.
//
// 추후 화면(RTL) 컴포넌트 테스트를 추가할 때(Phase 4~5):
//   pnpm add -D @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom
//   → plugins: [react()], test.environment: "jsdom" 로 확장.
// ─────────────────────────────────────────────

import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 영속 응답 캐시(server/cache.ts)는 기본적으로 os.tmpdir()/eumgil-cache 를 쓴다.
// 이 디렉터리는 dev·verify 실호출이 실데이터를 적재하는 곳이라, 테스트가 같이 쓰면
// 실제 캐시값이 목 fetch 를 가려 테스트가 깨진다(특히 setSystemTime 으로 과거 시각을
// 고정하면 캐시 age 가 음수가 되어 무조건 HIT). → 테스트 전용 디렉터리로 격리하고,
// 매 실행마다 비워 결정적으로 만든다.
const TEST_CACHE_DIR = path.join(os.tmpdir(), "eumgil-cache-test");
rmSync(TEST_CACHE_DIR, { recursive: true, force: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.ts"],
    // 공공 API 클라이언트는 requireEnv 로 키를 요구 → 테스트용 더미 키 주입(fetch 는 목).
    env: {
      TOUR_API_SERVICE_KEY: "test-key",
      KMA_SERVICE_KEY: "test-key",
      AIRKOREA_SERVICE_KEY: "test-key",
      // 실 캐시 파일과 격리 (위 주석 참고)
      EUMGIL_CACHE_DIR: TEST_CACHE_DIR,
    },
  },
});
