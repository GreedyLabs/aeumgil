"use client";

import type { InputHTMLAttributes } from "react";

export function ThemeQueryInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      {...props}
      type="text"
      enterKeyHint="search"
      onKeyDown={(event) => {
        // 한글 조합을 확정하는 Enter는 폼 제출로 이어지지 않는다.
        if (
          event.key === "Enter" &&
          (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
        ) {
          event.preventDefault();
          return;
        }
        props.onKeyDown?.(event);
      }}
    />
  );
}
