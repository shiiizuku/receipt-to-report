"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { STORAGE } from "@/lib/themes";
import { CollapseIcon, ExpandIcon } from "./icons";
import { Nav } from "./Nav";
import { ThemeControls } from "./ThemeControls";

interface Props {
  agency: string;
  isAdmin: boolean;
  user: { displayName: string; roleLabel: string };
  signOut: () => Promise<void>;
  children: ReactNode;
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function AppShell({ agency, isAdmin, user, signOut, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute("data-sidebar") === "collapsed");
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.getAttribute("data-sidebar") !== "collapsed";
    if (next) root.setAttribute("data-sidebar", "collapsed");
    else root.removeAttribute("data-sidebar");
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(STORAGE.sidebar, "collapsed");
      else localStorage.removeItem(STORAGE.sidebar);
    } catch {
      /* storage can be blocked */
    }
  }, []);

  // Ctrl/⌘ B toggles the sidebar, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b" || e.altKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);

  const hint = isMac() ? "⌘B" : "Ctrl B";
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <>
      <div className="topbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="topbar-logo" src="/branding/mgb-logo-160.png" alt="Mines and Geosciences Bureau" width={32} height={32} />
        <Nav variant="top" isAdmin={isAdmin} />
        <ThemeControls placement="down" />
      </div>
      <div className="app">
        <aside className="side" data-slot="app-sidebar" aria-label="Sidebar">
          <div className="brand">
            <span className="mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/mgb-logo-160.png" alt="Mines and Geosciences Bureau" width={36} height={36} />
            </span>
            <span className="brand-text">
              <b>Receipt-to-Report</b>
              <span>{agency}</span>
            </span>
          </div>
          <Nav variant="side" isAdmin={isAdmin} />
          <div className="side-foot">
            <div className="me">
              <div className="av" aria-hidden="true">
                {user.displayName.charAt(0)}
              </div>
              <div className="who">
                <div style={{ overflowWrap: "anywhere" }}>{user.displayName}</div>
                <small>{user.roleLabel}</small>
                <div className="who-links">
                  <Link href="/change-password" className="signout">
                    Change password
                  </Link>
                  <form action={signOut}>
                    <button className="signout" type="submit">
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </div>
            <div className="side-actions">
              <ThemeControls placement={collapsed ? "right" : "up"} />
              <button
                type="button"
                className="icon-btn collapse-btn"
                aria-label={label}
                aria-expanded={!collapsed}
                aria-keyshortcuts="Control+B Meta+B"
                title={`${label} (${hint})`}
                onClick={toggle}
              >
                {collapsed ? <ExpandIcon /> : <CollapseIcon />}
              </button>
            </div>
          </div>
        </aside>
        <main className="main" id="main">
          {children}
        </main>
      </div>
    </>
  );
}
