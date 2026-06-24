type IdPrefix = "usr" | "cmp";

export function createId(prefix: IdPrefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
