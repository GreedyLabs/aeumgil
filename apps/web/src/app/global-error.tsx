"use client";

// ─────────────────────────────────────────────
// 전역 에러 바운더리 — 루트 레이아웃 자체가 죽었을 때의 최후 방어선.
// 이 화면은 레이아웃(AppShell 포함)을 대체하므로 html/body 를 직접 렌더링해야 한다.
// 디자인 CSS 로드도 보장되지 않는 경로라 인라인 스타일만 쓴다. (운영-준비-플랜 §2.1)
// ─────────────────────────────────────────────

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F2EA",
          color: "#1A201C",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 20,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0, lineHeight: 1.3 }}>서비스에 문제가 발생했습니다</h1>
          <p style={{ fontSize: 14, color: "#6B7570", lineHeight: 1.6, margin: "12px 0 0" }}>
            잠시 후 다시 시도해 주세요. 문제가 계속되면 곧 복구하겠습니다.
          </p>
          {error.digest ? (
            <div style={{ fontSize: 11, color: "#9BA29E", marginTop: 10 }}>오류 코드: {error.digest}</div>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 22,
              padding: "12px 22px",
              fontSize: 14,
              fontWeight: 600,
              color: "#FDFBF4",
              background: "#2C4A38",
              border: "none",
              borderRadius: 100,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
