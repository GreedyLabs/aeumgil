import { SettingsView } from "@/components/screens/settings";
import { requireUserSession } from "@/server/require-session";

export default async function SettingsPage() {
  await requireUserSession("settings");
  return <SettingsView />;
}
