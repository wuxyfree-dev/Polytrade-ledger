import React from "react";

export function PageTitle({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-2xl font-semibold">{title}</div>
        {desc ? <div className="text-sm text-black/55 mt-1">{desc}</div> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}
