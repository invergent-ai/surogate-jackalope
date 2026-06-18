export function StatusBadge({ status }: { status: string }) {
  const kind = status.startsWith("error")
    ? "err"
    : status === "running"
      ? "ok"
      : status === "launching"
        ? "warn"
        : "idle";
  return <span className={"badge " + kind}>{status.split("\n")[0]}</span>;
}
