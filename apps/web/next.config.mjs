import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@eumgil/ui"],
  // Pin the workspace root so Next ignores stray lockfiles outside the monorepo.
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
