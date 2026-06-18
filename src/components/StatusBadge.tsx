const KIND: Record<string, string> = { running: "ok", launching: "warn", idle: "idle" };

export function StatusBadge({ status }: { status: string }) {
  const kind = status.startsWith("error") ? "err" : (KIND[status] ?? "idle");
  return <span className={"badge " + kind}>{status.split("\n")[0]}</span>;
}
