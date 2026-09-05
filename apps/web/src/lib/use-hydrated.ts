"use client";
import { useEffect, useState } from "react";

/** 서버 화면이 먼저 표시돼도 이벤트 연결 전에 입력을 잃지 않도록 한다. */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
