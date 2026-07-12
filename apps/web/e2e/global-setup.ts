import { loadRootEnv } from "./helpers/env";
import { cleanupTestUser } from "./helpers/db";

export default async function globalSetup(): Promise<void> {
  loadRootEnv();
  await cleanupTestUser();
}
