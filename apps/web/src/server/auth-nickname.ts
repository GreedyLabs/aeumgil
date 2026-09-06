import { createHash } from "node:crypto";

interface NicknameClaims {
  sub?: string | null;
  nickname?: unknown;
  preferred_username?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  email?: unknown;
}

function nicknameText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().normalize("NFC");
  if (!text || text.length > 20 || /[@\p{Cc}\p{Cf}]/u.test(text.normalize("NFKC"))) return null;
  return text;
}

/** 표시용 별명이며 계정 식별자·고유 닉네임으로 사용하지 않는다. */
export function generatedNickname(subject?: string | null): string {
  if (!subject) return "여행자";
  const suffix = createHash("sha256")
    .update(`eumgil:nickname:${subject}`)
    .digest("hex")
    .slice(0, 8);
  return `여행자-${suffix}`;
}

/** 소셜 계정의 실명·이메일을 표시명으로 승격하지 않는다. */
export function nicknameFromClaims(profile: NicknameClaims): string {
  const nickname = nicknameText(profile.nickname);
  if (nickname) return nickname;

  const username = nicknameText(profile.preferred_username);
  const comparable = (value: unknown) =>
    typeof value === "string"
      ? value
          .normalize("NFKC")
          .replace(/[\s._-]/gu, "")
          .toLowerCase()
      : "";
  const privateNames = [
    profile.name,
    profile.given_name,
    profile.family_name,
    [profile.given_name, profile.family_name].filter((value) => typeof value === "string").join(""),
    [profile.family_name, profile.given_name].filter((value) => typeof value === "string").join(""),
    typeof profile.email === "string" ? profile.email.split("@")[0] : "",
  ].map(comparable);
  if (username && !/\s/u.test(username) && !privateNames.includes(comparable(username))) {
    return username;
  }
  return generatedNickname(profile.sub);
}

/** 이전 로그인 쿠키에 남은 full name은 읽지 않는다. */
export function nicknameFromToken(token: { sub?: string; nickname?: unknown }): string {
  return nicknameText(token.nickname) || generatedNickname(token.sub);
}
