"use client";
import { useLanguage } from "@/components/language-context";
import { uiText } from "@/lib/i18n";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import type { Lang } from "@/lib/i18n";
import styles from "./external-link.module.css";

const externalPath = "M15 3h6v6m0-6L10 14M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6";

export function ExternalLinkIndicator() {
  return (
    <svg
      className={styles.indicator}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={externalPath} />
    </svg>
  );
}

// Leaflet이 생성하는 정적 저작권 HTML에도 같은 아이콘을 사용한다.
export const externalLinkIconHtml = `<svg class="${styles.indicator}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${externalPath}" /></svg>`;

type ExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "target" | "rel" | "href"> & {
  href: string;
  lang?: Lang;
  /** 카드 안의 CTA 또는 사진 위에 아이콘을 직접 배치할 때 사용한다. */
  indicatorPlacement?: "end" | "within";
};

export function ExternalLink({
  children,
  lang,
  indicatorPlacement = "end",
  "aria-label": label,
  title,
  ...props
}: ExternalLinkProps) {
  const selected = useLanguage();
  const notice = uiText("외부 사이트, 새 탭에서 열림", lang ?? selected);
  return (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? notice}
      aria-label={label ? `${label} (${notice})` : undefined}
    >
      {children}
      {indicatorPlacement === "end" && <ExternalLinkIndicator />}
      {!label && <span className={styles.srOnly}> ({notice})</span>}
    </a>
  );
}

type NewTabLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "target" | "rel"> & {
  lang?: Lang;
};

/** 편집 중인 화면을 유지하면서 서비스 내부의 상세를 여는 링크다. */
export function NewTabLink({
  children,
  lang,
  "aria-label": label,
  title,
  ...props
}: NewTabLinkProps) {
  const selected = useLanguage();
  const notice = uiText("새 탭에서 열림", lang ?? selected);
  return (
    <Link
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? notice}
      aria-label={label ? `${label} (${notice})` : undefined}
    >
      {children}
      <svg
        className={styles.indicator}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="8" y="3" width="13" height="13" rx="2" />
        <path d="M16 20H5a2 2 0 0 1-2-2V7" />
      </svg>
      {!label && <span className={styles.srOnly}> ({notice})</span>}
    </Link>
  );
}

export function ExternalPhotoIndicator() {
  return (
    <span className={styles.photoIndicator}>
      <ExternalLinkIndicator />
    </span>
  );
}

export const externalPhotoLinkClass = styles.photoLink;
