/** Matches DB `display_name_usable_for_handle` email-local heuristic. */
export function looksLikeEmailLocal(displayName: string): boolean {
  const name = displayName.trim();
  if (!name) return true;
  if (name.includes("@")) return true;
  return /^[A-Za-z0-9._%+-]*\.[A-Za-z0-9._%+-]+$/.test(name);
}

export function needsDisplayNamePrompt(
  displayName: string | null | undefined,
  email: string | null | undefined,
): boolean {
  const name = (displayName ?? "").trim();
  if (!name) return true;
  const local = (email ?? "").split("@")[0]?.trim().toLowerCase();
  if (local && name.toLowerCase() === local) return true;
  return looksLikeEmailLocal(name);
}

export function isDisplayNameValid(value: string): boolean {
  return value.trim().length >= 2;
}
