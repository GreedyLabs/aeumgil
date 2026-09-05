"use client";
import { useState } from "react";

interface AvatarProps {
  src: string;
  className: string;
  size?: number;
  name?: string;
}

export function Avatar({ src, className, size, name = "여행자" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden="true"
      className={`user-avatar ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      {src && !failed ? (
        // 소셜 계정 이미지 호스트는 사용자마다 다르므로 네이티브 이미지로 표시한다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        <span>{name.trim().slice(0, 1).toUpperCase() || "여"}</span>
      )}
    </span>
  );
}
