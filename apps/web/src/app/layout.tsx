import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "../design/styles.css";
import "../design/travel-ui.css";
import { AppShell } from "@/components/app-shell";
import { Providers } from "./providers";
import { cookies } from "next/headers";
import { requestLanguage } from "@/server/request-language";
import { DEFAULT_LANG, isLang, LANGUAGE_COOKIE } from "@/lib/i18n";

// 전 화면이 DB 카탈로그·실시간 데이터 기반이라 빌드 시점 정적 프리렌더가 무의미하고,
// 배포 빌더(Dockerfile builder/GitHub Actions)에는 DB가 주입되지 않아 프리렌더가 실패한다.
// → 전 라우트를 요청 시 렌더링으로 강제. 콜드 응답은 loading.tsx, 실패는 error.tsx가 받는다.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await requestLanguage();
  const titles = {
    ko: "에움길 — 강원 관광 추천",
    en: "Eumgil — Plan your Gangwon trip",
    "zh-CN": "Eumgil — 规划您的江原之旅",
    "zh-TW": "Eumgil — 規劃您的江原之旅",
    ja: "Eumgil — 江原の旅を計画",
    de: "Eumgil — Deine Reise nach Gangwon",
    fr: "Eumgil — Votre voyage au Gangwon",
  };
  const descriptions = {
    ko: "여행 목적을 입력하고 강원 테마를 비교하며 나만의 일정을 만들어요. 관광 정보와 사진, 오디오 가이드를 함께 제공해요.",
    en: "Discover themed trips in Gangwon and build your own itinerary with official visitor information, photos and audio guides.",
    "zh-CN": "探索江原主题旅行，利用官方旅游信息、照片和语音导览规划个人行程。",
    "zh-TW": "探索江原主題旅行，利用官方旅遊資訊、照片與語音導覽規劃個人行程。",
    ja: "江原のテーマ旅を探して自分だけの日程を作成。公式観光情報・写真・音声ガイドを提供します。",
    de: "Entdecke Themenreisen in Gangwon und plane deine Route mit offiziellen Informationen, Fotos und Audioguides.",
    fr: "Découvrez des voyages à thème au Gangwon et créez votre itinéraire avec des informations officielles, photos et audioguides.",
  };
  return { title: titles[lang], description: descriptions[lang] };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const lang = isLang(value) ? value : DEFAULT_LANG;
  return (
    <html lang={lang}>
      <body data-palette="ocean">
        <Providers>
          <AppShell initialLang={lang}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
