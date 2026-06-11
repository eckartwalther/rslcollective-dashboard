type IdPrefix = "usr" | "cmp" | "ses";

export function createId(prefix: IdPrefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
