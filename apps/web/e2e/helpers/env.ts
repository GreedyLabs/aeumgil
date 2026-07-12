// ─────────────────────────────────────────────
// 모노레포 루트 .env 로더 (E2E 전용).
// next.config.mjs 가 dotenv 로 하는 일을 Playwright 프로세스에서 재현한다.
// 이미 설정된 process.env 값은 덮어쓰지 않는다(.env.local → .env 순서로 읽어
// .env.local 이 우선하는 규칙도 동일).
// __dirname/import.meta 는 Playwright 의 CJS/ESM 트랜스파일 방식에 따라 달라지므로,
// cwd(apps/web)에서 위로 올라가며 .env 가 있는 루트를 찾는다.
// ─────────────────────────────────────────────

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function applyEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1] as string;
    let value = (m[2] as string).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, ".env")) || existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** 루트 .env.local → .env 순으로 로드(선순위 보존). playwright.config 에서 1회 호출. */
export function loadRootEnv(): void {
  const root = findRepoRoot();
  applyEnvFile(path.join(root, ".env.local"));
  applyEnvFile(path.join(root, ".env"));
}
