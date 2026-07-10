// 스팟 상세는 날씨/대기질/관광상세 보강 호출이 있다. (운영-준비-플랜 §2.1)
import { RouteLoading } from "@/components/route-fallback";

export default function SpotLoading() {
  return <RouteLoading label="스팟 정보를 불러오는 중…" />;
}
