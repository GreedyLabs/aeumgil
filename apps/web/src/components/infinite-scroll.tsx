"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./infinite-scroll.module.css";

type InfiniteScrollProps = {
  hasMore: boolean;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  onLoadMore: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  label: string;
  resetKey: string | number;
  progressKey: string | number;
  children?: ReactNode;
  id?: string;
};

/** 화면 하단이 가까워질 때 한 묶음만 추가한다. 키보드·미지원 환경에서는 버튼도 사용할 수 있다. */
export function InfiniteScroll({
  hasMore,
  loading = false,
  error,
  disabled = false,
  onLoadMore,
  onRetry,
  label,
  resetKey,
  progressKey,
  children,
  id,
}: InfiniteScrollProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const action = useRef(onLoadMore);
  const lock = useRef<{ key: string | number; token: symbol } | undefined>(undefined);
  const [manual, setManual] = useState(false);
  const [localError, setLocalError] = useState<{ key: string | number; message: string }>();
  const failure = error || (localError?.key === resetKey ? localError.message : "");
  useEffect(() => {
    action.current = onLoadMore;
  });
  useEffect(() => {
    setLocalError(undefined);
  }, [resetKey, progressKey]);
  useEffect(() => {
    lock.current = undefined;
  }, [disabled, resetKey]);
  useEffect(() => {
    if (typeof window.IntersectionObserver !== "function") {
      setManual(true);
      return;
    }
    if (!hasMore || disabled || loading || failure || !sentinel.current) return;
    let active = true;
    let triggered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !active ||
          triggered ||
          lock.current?.key === resetKey ||
          !entries.some((entry) => entry.isIntersecting)
        )
          return;
        triggered = true;
        observer.disconnect();
        const token = Symbol();
        lock.current = { key: resetKey, token };
        Promise.resolve()
          .then(() => {
            if (active) return action.current();
          })
          .catch(() => {
            if (lock.current?.token === token)
              setLocalError({
                key: resetKey,
                message: "목록을 불러오지 못했어요. 다시 시도해 주세요.",
              });
          })
          .finally(() => {
            if (lock.current?.token === token) lock.current = undefined;
          });
      },
      { rootMargin: "0px 0px 240px 0px", threshold: 0 },
    );
    observer.observe(sentinel.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [hasMore, disabled, loading, failure, resetKey, progressKey]);

  const retry = async () => {
    if (disabled || loading || lock.current?.key === resetKey) return;
    const token = Symbol();
    lock.current = { key: resetKey, token };
    try {
      await (failure && onRetry ? onRetry() : onLoadMore());
      if (lock.current?.token === token) setLocalError(undefined);
    } catch {
      if (lock.current?.token === token)
        setLocalError({ key: resetKey, message: "목록을 불러오지 못했어요. 다시 시도해 주세요." });
    } finally {
      if (lock.current?.token === token) lock.current = undefined;
    }
  };
  return (
    <div ref={sentinel} id={id} className={styles.boundary} data-infinite-scroll={label}>
      <div className={styles.status} role="status" aria-live="polite" aria-atomic="true">
        {children && <div>{children}</div>}
        {loading ? (
          <p>{label} 불러오는 중…</p>
        ) : (
          !hasMore && !failure && <p>목록을 모두 확인했어요.</p>
        )}
      </div>
      {failure && (
        <p role="alert" className={styles.error}>
          {failure}
        </p>
      )}
      {(hasMore || failure) && (
        <button
          type="button"
          disabled={disabled || loading}
          className={`btn btn-secondary ${manual || failure ? "" : styles.keyboardAction}`}
          onClick={() => void retry()}
        >
          {failure ? `${label} 다시 불러오기` : `다음 ${label} 불러오기`}
        </button>
      )}
    </div>
  );
}
