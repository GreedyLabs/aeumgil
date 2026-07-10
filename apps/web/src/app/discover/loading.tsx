// 콜드 캐시 시 공공 API 대기가 빈 화면으로 보이지 않게 한다. (운영-준비-플랜 §2.1)
import { RouteLoading } from "@/components/route-fallback";

export default function DiscoverLoading() {
  return <RouteLoading label="테마를 불러오는 중…" />;
}
