import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary: "bg-white text-emerald-800 border border-emerald-700 hover:bg-emerald-50",
  ghost: "bg-transparent text-emerald-800 hover:bg-emerald-50",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
