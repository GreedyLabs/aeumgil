"use client";

import { useLanguage } from "@/components/language-context";
import { useEffect, useRef, useState } from "react";
import { searchCoursePlacesAction } from "@/app/actions/personal-course";
import type { CoursePlaceSearchResult, CourseSearchKind } from "@/domain/course-place-search";

interface SearchFilters {
  q: string;
  region: string;
  accessibility: "" | "info";
  kind: CourseSearchKind;
}
const message = "장소 검색을 불러오지 못했어요. 다시 시도해 주세요.";

/** 개인 검색의 공개 DB 페이지를 누적한다. 검색 조건·요청 번호가 지난 응답은 사용하지 않는다. */
export function useCoursePlaceSearch(initial: CoursePlaceSearchResult, enabled: boolean) {
  const lang = useLanguage();
  const language = useRef(lang);
  language.current = lang;
  const keyOf = (filters: SearchFilters) => `${language.current}:${JSON.stringify(filters)}`;
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    q: initial.query.q,
    region: initial.query.region,
    accessibility: initial.query.accessibility === "info" ? "info" : "",
    kind: initial.kind,
  }));
  const key = keyOf(filters);
  const [snapshot, setSnapshot] = useState(() => ({
    result: initial,
    key,
    complete: !initial.items.length || initial.page * initial.pageSize >= initial.total,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentFilters = useRef(filters);
  const currentSnapshot = useRef(snapshot);
  const active = useRef(enabled);
  const generation = useRef(0);
  const inFlight = useRef<{ generation: number; key: string; page: number } | null>(null);
  const failed = useRef<{ key: string; page: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancel = () => {
    generation.current++;
    inFlight.current = null;
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const searchPage = async (page: number, explicit = false) => {
    const conditions = currentFilters.current;
    const requestKey = keyOf(conditions);
    if (!active.current || inFlight.current || (!explicit && failed.current?.key === requestKey))
      return;
    clearTimeout(timer.current);
    timer.current = undefined;
    const seq = ++generation.current;
    inFlight.current = { generation: seq, key: requestKey, page };
    failed.current = null;
    setLoading(true);
    setError("");
    try {
      const result = await searchCoursePlacesAction(
        {
          q: conditions.q,
          region: conditions.region,
          accessibility: conditions.accessibility,
          page,
        },
        conditions.kind,
      );
      if (generation.current !== seq || keyOf(currentFilters.current) !== requestKey) return;
      if (
        result.kind !== conditions.kind ||
        !Number.isInteger(result.page) ||
        result.page < 1 ||
        result.page > page
      )
        throw Error("검색 결과의 페이지가 달라요.");
      const previous = currentSnapshot.current;
      const accumulated = page > 1 && previous.key === requestKey ? previous.result.items : [];
      if (result.page < page) {
        // 총건수 감소로 서버가 마지막 페이지를 보정하면 기존 목록을 유지하고 조회를 마친다.
        const next = { result: { ...result, items: accumulated }, key: requestKey, complete: true };
        currentSnapshot.current = next;
        setSnapshot(next);
        return;
      }
      const seen = new Set<string>();
      const items = [...accumulated, ...result.items].filter((place) => {
        if (seen.has(place.id)) return false;
        seen.add(place.id);
        return true;
      });
      // 총건수가 조회 도중 바뀌거나 페이지가 중복되어도 빈 요청을 자동 반복하지 않는다.
      const complete =
        !result.items.length ||
        (page > 1 && items.length === accumulated.length) ||
        result.page * result.pageSize >= result.total;
      const next = { result: { ...result, items }, key: requestKey, complete };
      currentSnapshot.current = next;
      setSnapshot(next);
    } catch {
      if (generation.current === seq && keyOf(currentFilters.current) === requestKey) {
        failed.current = { key: requestKey, page };
        setError(message);
      }
    } finally {
      if (generation.current === seq) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  };
  const changeFilters = (change: Partial<SearchFilters>) => {
    const next = { ...currentFilters.current, ...change };
    if (keyOf(next) === keyOf(currentFilters.current)) return;
    // 필터 입력 이벤트에서 즉시 잠근다. debounce 동안 이전 조건의 다음 페이지가 시작되지 않는다.
    cancel();
    currentFilters.current = next;
    // 이전 필터로 빠르게 돌아와도 새 목록은 첫 페이지부터 시작한다.
    const retained = { ...currentSnapshot.current, key: "" };
    currentSnapshot.current = retained;
    setSnapshot(retained);
    failed.current = null;
    setError("");
    setLoading(false);
    setFilters(next);
  };
  useEffect(() => {
    active.current = enabled;
    // 언어 변경도 검색 조건 변경이다. 이전 요청이 새 언어의 첫 요청을 잠그지 않게 한다.
    cancel();
    setLoading(false);
    if (failed.current && failed.current.key !== key) {
      failed.current = null;
      setError("");
    }
    if (!enabled) {
      return;
    }
    if (currentSnapshot.current.key !== key && failed.current?.key !== key) {
      timer.current = setTimeout(() => void searchPage(1), 350);
    }
    return () => clearTimeout(timer.current);
    // 입력 조건과 검색 패널 가시성만 재검색을 결정한다. 누적 결과 변경은 추가 요청을 만들지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  useEffect(
    () => () => {
      active.current = false;
      cancel();
    },
    [],
  );

  const current = snapshot.key === key;
  const result = current
    ? snapshot.result
    : { ...snapshot.result, kind: filters.kind, items: [], total: 0, page: 0 };
  const hasMore =
    current &&
    !snapshot.complete &&
    result.page < 500 &&
    result.page * result.pageSize < result.total;
  return {
    filters,
    changeFilters,
    result,
    loading: loading || (!current && !error && enabled),
    error,
    resetKey: key,
    progressKey: `${key}:${result.page}`,
    hasMore,
    refresh: () => {
      if (!active.current) return;
      cancel();
      void searchPage(1, true);
    },
    loadMore: async () => {
      const latest = currentSnapshot.current;
      if (latest.key !== keyOf(currentFilters.current) || latest.complete || failed.current) return;
      if (
        latest.result.page * latest.result.pageSize >= latest.result.total ||
        latest.result.page >= 500
      )
        return;
      await searchPage(latest.result.page + 1);
    },
    retry: async () => {
      const failedPage = failed.current;
      if (failedPage?.key === keyOf(currentFilters.current))
        await searchPage(failedPage.page, true);
    },
  };
}
