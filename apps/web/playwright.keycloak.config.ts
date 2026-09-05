import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-keycloak",
  timeout: 30_000,
  workers: 1,
  use: {
    locale: "ko-KR",
    baseURL: process.env.KEYCLOAK_PREVIEW_URL || "http://localhost:8188",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
});
