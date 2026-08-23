/** Six muted tints for generated covers — low saturation, never brand orange. */
const COVER_TINTS = [
  "#E8E4DF",
  "#DDE5E8",
  "#E5E3EC",
  "#E0E8E0",
  "#E8E0E4",
  "#E4E6E0",
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
