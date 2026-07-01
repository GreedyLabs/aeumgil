"use client";

interface AvatarProps {
  src: string;
  className: string;
  size?: number;
}

export function Avatar({ src, className, size }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        ...(size ? { width: size, height: size } : {}),
        display: "block",
        backgroundImage: src ? `url("${src}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}
