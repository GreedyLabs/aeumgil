import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readSessionToken } from "@/server/session-token";
import { keycloakEndSessionUrl } from "@/server/auth";

export async function GET(req: NextRequest) {
  const token = await readSessionToken(req.headers);
  const logoutUrl = keycloakEndSessionUrl(
    typeof token?.idToken === "string" ? token.idToken : undefined,
  );

  if (req.nextUrl.searchParams.get("format") === "json") {
    return NextResponse.json({ url: logoutUrl }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.redirect(logoutUrl, { headers: { "Cache-Control": "no-store" } });
}
