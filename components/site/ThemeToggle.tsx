"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/md/Icon";
import { setPrefCookie, THEME_COOKIE, type ThemePref } from "@/lib/prefs";

function detectTheme(): ThemePref {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePref>("light");

  // Read the actual theme on mount (document isn't available during SSR).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(detectTheme());
  }, []);

  function toggle() {
    const next: ThemePref = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setPrefCookie(THEME_COOKIE, next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid place-items-center size-10 rounded-full hover:bg-on-surface/8 text-on-surface-variant"
    >
      <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} />
    </button>
  );
}
