import type { Location } from "react-router-dom";

export type LoginLocationState = {
  background?: Location;
};

export const MARKETPLACE_LOCATION: Location = {
  pathname: "/",
  search: "",
  hash: "",
  state: null,
  key: "marketplace",
};

export const LOGIN_CARD_CLASS =
  "h-full w-full max-w-none overflow-y-auto rounded-none border-0 shadow-none sm:h-auto sm:max-w-md sm:rounded-2xl sm:border sm:shadow-sm";

export function readLoginBackground(state: unknown): Location | null {
  if (!state || typeof state !== "object") return null;
  const background = (state as LoginLocationState).background;
  if (!background || typeof background.pathname !== "string") return null;
  if (background.pathname === "/login") return null;
  return background;
}

export function loginPath(next?: string | null) {
  if (next) return `/login?next=${encodeURIComponent(next)}`;
  return "/login";
}

export function loginState(location: Location): LoginLocationState {
  return { background: location };
}
