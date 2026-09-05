"use client";

import { useEffect, useState } from "react";
import { calendarDateAt, courseDateCount, dayForCalendarDate } from "@/domain/course-dates";
import styles from "./course-day-input.module.css";

/** 날짜가 정해지면 달력, 미정이면 자유로운 일차 입력을 사용한다. 전체 날짜 배열은 만들지 않는다. */
export function CourseDayInput({
  value,
  onChange,
  startDate,
  endDate,
  label,
  navigation = false,
  disabled = false,
}: {
  value: number;
  onChange: (day: number) => void;
  startDate?: string;
  endDate?: string;
  label: string;
  navigation?: boolean;
  disabled?: boolean;
}) {
  const date = calendarDateAt(startDate, value);
  const dated = Boolean(startDate && date);
  const displayed = dated ? date! : String(value);
  const max = courseDateCount(startDate, endDate) ?? Number.MAX_SAFE_INTEGER;
  const [text, setText] = useState(displayed);
  useEffect(() => setText(displayed), [displayed, startDate, endDate]);
  return (
    <div className={`${styles.picker} course-day-picker`}>
      {navigation && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-label={`${label} 이전 날`}
          disabled={disabled || value <= 1}
          onClick={() => onChange(value - 1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
      )}
      <div className={styles.field}>
        {!dated && (
          <span className={styles.prefix} aria-hidden="true">
            Day
          </span>
        )}
        <input
          className={`input ${!dated ? styles.undated : ""}`}
          aria-label={label}
          type={dated ? "date" : "number"}
          min={dated ? startDate : 1}
          max={dated ? (endDate ?? "9999-12-31") : Number.MAX_SAFE_INTEGER}
          step={1}
          value={text}
          disabled={disabled}
          onChange={(event) => {
            const nextText = event.target.value;
            setText(nextText);
            const next = dated ? dayForCalendarDate(startDate!, nextText) : Number(nextText);
            if (next !== undefined && Number.isSafeInteger(next) && next >= 1 && next <= max)
              onChange(next);
          }}
          onBlur={() => setText(displayed)}
        />
      </div>
      {navigation && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-label={`${label} 다음 날`}
          disabled={disabled || value >= max || (dated && !calendarDateAt(startDate, value + 1))}
          onClick={() => onChange(value + 1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}
