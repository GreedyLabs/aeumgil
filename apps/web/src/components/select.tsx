import type { SelectHTMLAttributes } from "react";

/** 네이티브 키보드·모바일 선택 동작은 유지하고 모든 화면의 외형을 통일한다. */
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`select-control ${className}`} />;
}
