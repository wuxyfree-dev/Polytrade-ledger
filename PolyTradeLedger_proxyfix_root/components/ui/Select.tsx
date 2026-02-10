import clsx from "clsx";
import React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: Props) {
  return (
    <select
      className={clsx(
        "w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/15",
        className
      )}
      {...props}
    />
  );
}
