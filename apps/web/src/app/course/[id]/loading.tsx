// 코스 구성 + 실시간 보강(날씨/혼잡/이동시간)은 콜드 캐시에서 수 초 걸릴 수 있다. (운영-준비-플랜 §2.1)
import { RouteLoading } from "@/components/route-fallback";

export default function CourseLoading() {
  return <RouteLoading label="코스와 실시간 정보를 준비하는 중…" />;
}
