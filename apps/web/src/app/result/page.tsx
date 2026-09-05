import Link from "next/link";
import { MatchingView } from "@/components/screens/matching";
import { RouteNotice } from "@/components/route-fallback";
import { getRepository } from "@/data";
import { INTENT_QUERY_MAX_LENGTH, normalizeIntentQuery } from "@/domain/matching";
import { str, type SearchParams } from "@/lib/search-params";

export default async function ResultPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // 빈 입력과 과도한 길이는 매칭 전에 안내한다.
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

  const repo = getRepository();
  const match = await repo.matchThemes(query);
  const [primary, ...alternatives] = await Promise.all(
    [match.primaryId, ...match.altIds].map((id) =>
      id ? repo.getTheme(id) : Promise.resolve(null),
    ),
  );
  return (
    <MatchingView
      key={query}
      query={query}
      match={match}
      primary={primary ?? null}
      alternatives={alternatives.filter((theme) => theme !== null)}
    />
  );
}
