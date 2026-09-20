import type { ReactNode } from "react";

export function StatusBadge({ status }: { status: import("../rules/types").TaskStatus }) {
  const labels = {
    open: "修蹄中",
    recheck: "复查中",
    closed: "已闭环",
    superseded: "旧结论失效",
  } as const;
  return <span className={`badge badge-${status}`}>{labels[status]}</span>;
}

export function Banner({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  return <div className={`banner banner-${kind}`}>{children}</div>;
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="empty-hint">{children}</p>;
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span>
      {children}
      {required && <em className="required-mark">*</em>}
    </span>
  );
}
