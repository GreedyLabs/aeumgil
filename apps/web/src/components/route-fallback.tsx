// ─────────────────────────────────────────────
// 라우트 세그먼트 폴백 공용 UI — app/ 의 loading.tsx / error.tsx / not-found.tsx 에서 사용.
// 화면 뷰(screens/*)가 아니라 크롬 안에 끼워지는 폴백이므로,
// design 프리미티브 없이 전역 토큰(styles.css)만으로 가볍게 그린다.
// ─────────────────────────────────────────────

/** 데이터 페치 대기 중 표시 (loading.tsx). 콜드 캐시 공공 API 대기가 빈 화면으로 보이지 않게 한다. */
export function RouteLoading({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", gap: 6 }} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--brand-2)",
              animation: `pulse-dot 1.1s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
      <div role="status" style={{ fontSize: 13, color: "var(--ink-3)" }}>
        {label}
      </div>
    </div>
  );
}

/** 에러/404 공용 안내 레이아웃. actions 에 버튼/링크를 넘긴다. */
export function RouteNotice({
  title,
  message,
  detail,
  actions,
}: {
  title: string;
  message: string;
  detail?: string;
  actions: React.ReactNode;
}) {
  return (
    <div
      className="screen-enter"
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: "30px 24px", textAlign: "center" }}>
        <h1 className="serif" style={{ fontSize: 24, margin: 0, lineHeight: 1.25 }}>
          {title}
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6, margin: "12px 0 0" }}>{message}</p>
        {detail ? (
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 10, wordBreak: "break-all" }}>{detail}</div>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
          {actions}
        </div>
      </div>
    </div>
  );
}
