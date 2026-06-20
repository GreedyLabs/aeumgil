import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// 모노레포 루트의 .env / .env.local 을 로드한다.
// (Next 는 기본적으로 앱 디렉터리만 보므로, 루트 단일 소스를 명시적으로 읽는다.)
// .env.local 이 있으면 .env 값을 덮어쓴다.
loadEnv({ path: resolve(monorepoRoot, ".env") });
loadEnv({ path: resolve(monorepoRoot, ".env.local"), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@eumgil/ui"],
  // Emit a self-contained server bundle so the Docker runtime image stays slim.
  output: "standalone",
  // Pin the workspace root so Next ignores stray lockfiles outside the monorepo.
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
