// Next.js searchParams 값(string | string[] | undefined)에서 단일 문자열을 안전하게 추출.
export function str(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
