import Link from "next/link";
import { MatchingView } from "@/components/screens/matching";
import { RouteNotice } from "@/components/route-fallback";
import { getRepository } from "@/data";
import { INTENT_QUERY_MAX_LENGTH, normalizeIntentQuery } from "@/domain/matching";
import { str, type SearchParams } from "@/lib/search-params";

export default async function ResultPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // [운영-준비-플랜 §3.1] 무인증 진입점 입력 방어 — 빈/초과 입력은 매칭(LLM 경로)에
  // 진입하지 않고 안내한다. 정상 입력만 리포지토리로 내려보낸다.
  const query = normalizeIntentQuery(str(sp.q) ?? "");
  if (!query || query.length > INTENT_QUERY_MAX_LENGTH) {
    return (
      <RouteNotice
        title={query ? "입력이 너무 길어요" : "여행 목적을 입력해 주세요"}
        message={
          query
            ? `여행 목적은 ${INTENT_QUERY_MAX_LENGTH}자 이내로 적어 주세요. 핵심만 남기면 더 잘 맞는 테마를 찾을 수 있어요.`
            : "어떤 여행을 하고 싶은지 한 문장으로 알려 주시면 강원도 테마를 찾아 드려요."
        }
        actions={
          <Link className="btn btn-primary" href="/">
            홈에서 입력하기
          </Link>
        }
      />
    );
  }

  const { primaryId, altIds } = await getRepository().matchThemes(query);
  return <MatchingView query={query} primaryId={primaryId} altIds={altIds} />;
}
