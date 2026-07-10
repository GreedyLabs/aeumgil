"use client";

// ─────────────────────────────────────────────
// 루트 에러 바운더리 — 서버 오류(DB 불능·공공 API 연쇄 실패·에이전트 예외 등)가
// Next 기본 500 화면 대신 서비스 톤 안내로 보이게 한다. (운영-준비-플랜 §2.1)
// reset() 은 해당 라우트 세그먼트를 다시 렌더링한다(일시 장애 복구용).
// ─────────────────────────────────────────────

import { useEffect } from "react";
import { RouteNotice } from "@/components/route-fallback";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영에서 조용히 삼켜지지 않게 콘솔로 남긴다(서버 측 원인은 서버 로그에 별도 기록됨).
    console.error("[route-error]", error);
  }, [error]);

  return (
    <RouteNotice
      title="화면을 불러오지 못했습니다"
      message="일시적인 문제일 수 있습니다. 잠시 후 다시 시도해 주세요."
      detail={error.digest ? `오류 코드: ${error.digest}` : undefined}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={reset}>
            다시 시도
          </button>
          <a className="btn btn-secondary" href="/">
            홈으로
          </a>
        </>
      }
    />
  );
}
