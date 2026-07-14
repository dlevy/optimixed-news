export const VIEW_COOKIE = "optx_view";
export const THEME_COOKIE = "optx_theme";

export type ViewPref = "tile" | "list";
export type ThemePref = "light" | "dark";

/** Write a preference cookie from the client (1-year, lax). */
export function setPrefCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
