import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "../design/styles.css";
import "../design/travel-ui.css";
import { AppShell } from "@/components/app-shell";
import { Providers } from "./providers";

// 전 화면이 DB 카탈로그·실시간 데이터 기반이라 빌드 시점 정적 프리렌더가 무의미하고,
// 배포 빌더(Dockerfile builder/GitHub Actions)에는 DB가 주입되지 않아 프리렌더가 실패한다.
// → 전 라우트를 요청 시 렌더링으로 강제. 콜드 응답은 loading.tsx, 실패는 error.tsx가 받는다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "에움길 — 강원 관광 추천",
  description:
    "여행 목적을 자연어로 입력하면 강원도 특화 테마 코스를 추천하고, 혼잡도와 방문 적합성을 함께 안내하는 공공형 관광 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body data-palette="ocean">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
