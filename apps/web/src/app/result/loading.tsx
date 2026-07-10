// 테마 매칭(에이전트/LLM 경로 포함)은 수 초 걸릴 수 있다. (운영-준비-플랜 §2.1)
import { RouteLoading } from "@/components/route-fallback";

export default function ResultLoading() {
  return <RouteLoading label="여행 목적에 맞는 테마를 찾는 중…" />;
}
