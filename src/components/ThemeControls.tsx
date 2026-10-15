"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DEFAULT_THEME, STORAGE, THEMES } from "@/lib/themes";
import { MoonIcon, PaletteIcon, SunIcon } from "./icons";

type Mode = "light" | "dark" | "system";

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage can be blocked; the choice then lasts until reload */
  }
}

/** Applies the theme and colour mode to <html> with a short colour fade, none when motion is reduced. */
function apply(attr: "data-theme" | "data-mode", value: string | null) {
  const root = document.documentElement;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.setAttribute("data-switching", "");
    window.setTimeout(() => root.removeAttribute("data-switching"), 220);
  }
  if (value === null) root.removeAttribute(attr);
  else root.setAttribute(attr, value);
}

export function ThemeControls({ placement }: { placement: "up" | "right" | "down" }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [mode, setMode] = useState<Mode>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    const root = document.documentElement;
    setTheme(root.getAttribute("data-theme") ?? DEFAULT_THEME);
    const m = root.getAttribute("data-mode");
    setMode(m === "light" || m === "dark" ? m : "system");
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(q.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  const dark = mode === "dark" || (mode === "system" && systemDark);

  function chooseTheme(id: string) {
    setTheme(id);
    apply("data-theme", id);
    store(STORAGE.theme, id);
    close(true);
  }

  function chooseMode(next: Mode) {
    setMode(next);
    apply("data-mode", next === "system" ? null : next);
    store(STORAGE.mode, next === "system" ? null : next);
  }

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="theme-controls">
      <button
        ref={trigger}
        type="button"
        className="icon-btn"
        aria-label={`Theme: ${current.name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        data-open={open || undefined}
        title={`Theme: ${current.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <PaletteIcon />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => chooseMode(dark ? "light" : "dark")}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      {open ? (
        <div ref={panel} id={panelId} className={`popover ${placement}`} role="dialog" aria-label="Theme and appearance">
          <h3 className="pop-title">Theme</h3>
          <div className="swatches">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="swatch"
                aria-label={t.name}
                aria-pressed={t.id === theme}
                title={t.name}
                onClick={() => chooseTheme(t.id)}
              >
                <span className="dot" style={{ background: dark ? t.dark.accent : t.light.accent, boxShadow: `0 0 0 3px ${dark ? t.dark.bar : t.light.bar}` }} />
              </button>
            ))}
          </div>
          <p className="pop-name" aria-live="polite">
            {current.name}
          </p>
          <h3 className="pop-title" style={{ marginTop: 10 }}>
            Appearance
          </h3>
          <div className="togg" role="group" aria-label="Appearance" style={{ width: "100%" }}>
            {(["light", "dark", "system"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => chooseMode(m)} style={{ flex: 1 }}>
                {m === "light" ? "Light" : m === "dark" ? "Dark" : "System"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
