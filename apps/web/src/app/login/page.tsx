import { LoginView } from "@/components/screens/login";
import { getRepository } from "@/data";
import { str, type SearchParams } from "@/lib/search-params";

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const providers = await getRepository().listProviders();
  return <LoginView providers={providers} reason={str(sp.reason)} returnTo={str(sp.returnTo)} error={str(sp.error)} />;
}
