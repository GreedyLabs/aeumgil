"use client";

import { Icon } from "./_ui";

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  size?: number;
  buttonSize?: number;
}

export function RatingStars({ value, onChange, disabled, size = 13, buttonSize = 24 }: RatingStarsProps) {
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span style={{ display: "inline-flex", gap: 1, color: "var(--accent)" }}>
        {stars.map((score) => (
          <Icon.star key={score} style={{ width: size, height: size, color: score <= value ? "var(--accent)" : "var(--line-2)" }} />
        ))}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 1, color: "var(--accent)" }}>
      {stars.map((score) => (
        <button
          key={score}
          type="button"
          className="icon-btn"
          disabled={disabled}
          onClick={() => onChange(score)}
          aria-label={`${score}점`}
          style={{ width: buttonSize, height: buttonSize, color: score <= value ? "var(--accent)" : "var(--line-2)" }}
        >
          <Icon.star style={{ width: size, height: size }} />
        </button>
      ))}
    </span>
  );
}
