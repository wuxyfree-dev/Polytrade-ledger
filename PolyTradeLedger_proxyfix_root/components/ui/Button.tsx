import clsx from "clsx";
import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ className, variant="primary", size="md", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-2xl px-4 py-2 font-medium transition focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50";
  const variants = {
    primary: "bg-black text-white hover:bg-black/90",
    ghost: "bg-white text-black hover:bg-black/5 border border-black/10",
    danger: "bg-red-600 text-white hover:bg-red-700"
  } as const;
  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-sm px-4 py-2"
  } as const;

  return <button className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}
