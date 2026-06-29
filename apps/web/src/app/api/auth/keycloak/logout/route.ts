import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";
import { keycloakEndSessionUrl } from "@/server/auth";

export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: env.AUTH_SECRET || "eumgil-dev-only-auth-secret-change-before-production",
  });
  const logoutUrl = keycloakEndSessionUrl(typeof token?.idToken === "string" ? token.idToken : undefined);

  if (req.nextUrl.searchParams.get("format") === "json") {
    return NextResponse.json({ url: logoutUrl });
  }
  return NextResponse.redirect(logoutUrl);
}
