// 404 — 존재하지 않는 경로/리소스 안내. (운영-준비-플랜 §2.1)
import Link from "next/link";
import { RouteNotice } from "@/components/route-fallback";

export default function NotFound() {
  return (
    <RouteNotice
      title="페이지를 찾을 수 없습니다"
      message="주소가 바뀌었거나 없는 페이지입니다. 홈에서 다시 시작해 보세요."
      actions={
        <Link className="btn btn-primary" href="/">
          홈으로
        </Link>
      }
    />
  );
}
