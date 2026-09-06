"use client";
import { useId } from "react";
import { isLang, LANGUAGE_OPTIONS, uiText, type Lang } from "@/lib/i18n";
import { Select } from "./select";
import styles from "./language-picker.module.css";
export function LanguagePicker({
  lang,
  onChange,
  compact = false,
  hideLabel = false,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  const field = (
    <div className={styles.picker}>
      <label htmlFor={id} className={hideLabel ? styles.hiddenLabel : undefined}>
        {uiText("언어", lang)}
      </label>
      <Select
        id={id}
        value={lang}
        onChange={(event) => {
          if (isLang(event.target.value)) onChange(event.target.value);
        }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} lang={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
  if (!compact) return field;
  return (
    <div className={styles.compact}>
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </svg>
      <select
        aria-label={uiText("언어 설정", lang)}
        title={uiText("언어 설정", lang)}
        value={lang}
        onChange={(event) => {
          if (isLang(event.target.value)) onChange(event.target.value);
        }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} lang={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
