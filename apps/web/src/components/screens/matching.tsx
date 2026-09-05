"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { urlFor } from "@/lib/nav";

// 서버 매칭이 끝난 뒤 인위적인 타이머 없이 결과로 이동한다.
// replace로 경유 화면을 히스토리에서 빼 뒤로가기 루프를 막는다.
export function MatchingView({
  query,
  primaryId,
  altIds,
}: {
  query: string;
  primaryId: string;
  altIds: string[];
}) {
  const router = useRouter();
  const href = urlFor("theme", { themeId: primaryId, altIds, query });
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return (
    <div className="screen-enter matching-page empty-state" aria-live="polite">
      <span className="eyebrow">테마 매칭</span>
      <h1>어울리는 여행을 찾았어요</h1>
      <p>“{query}”에 맞는 테마로 이동하고 있어요.</p>
      <Link href={href} className="btn btn-primary">
        추천 테마 보기
      </Link>
    </div>
  );
}
