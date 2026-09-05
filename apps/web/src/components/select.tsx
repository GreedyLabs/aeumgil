"use client";
import { useHydrated } from "@/lib/use-hydrated";
import type { SelectHTMLAttributes } from "react";

/** 네이티브 키보드·모바일 선택 동작은 유지하고 모든 화면의 외형을 통일한다. */
export function Select({
  className = "",
  disabled,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const ready = useHydrated();
  return (
    <select disabled={!ready || disabled} {...props} className={`select-control ${className}`} />
  );
}
