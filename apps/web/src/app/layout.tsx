import type { Metadata, Viewport } from "next";
import "../design/styles.css";
import { AppShell } from "@/components/app-shell";

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
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
