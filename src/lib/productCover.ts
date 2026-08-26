/** Six low-saturation tints — no brand orange. */
const COVER_TINTS = [
  "#E6E8EB",
  "#E4E9E6",
  "#E7E5EA",
  "#E8E7E2",
  "#E3E7EA",
  "#E7E6E3",
] as const;

export function coverTintFromId(id: string): string {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return COVER_TINTS[(hash >>> 0) % COVER_TINTS.length];
}

export function sellerInitial(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  return trimmed.charAt(0).toUpperCase() || "D";
}
