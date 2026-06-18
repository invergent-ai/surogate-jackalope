/** Parse a comma-separated GPU-index string into a sorted unique-ish number[]. */
export const parseGpus = (s: unknown): number[] =>
  String(s ?? "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => !Number.isNaN(n));

/** MiB → whole GB, for memory labels. */
export const gb = (mib: number): number => Math.round(mib / 1024);
