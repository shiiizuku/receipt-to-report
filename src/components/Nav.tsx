"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BooksIcon, DepositsIcon, NewReceiptIcon, ReceiptsIcon, ReportsIcon, TodayIcon, UsersIcon } from "./icons";

const ITEMS: Array<{ href: string; label: string; icon: ReactNode }> = [
  { href: "/", label: "Today", icon: <TodayIcon /> },
  { href: "/receipts/new", label: "New receipt", icon: <NewReceiptIcon /> },
  { href: "/receipts", label: "Receipts", icon: <ReceiptsIcon /> },
  { href: "/books", label: "OR books", icon: <BooksIcon /> },
  { href: "/deposits", label: "Deposits", icon: <DepositsIcon /> },
  { href: "/reports", label: "Reports", icon: <ReportsIcon /> },
];

const ADMIN_ITEMS: Array<{ href: string; label: string; icon: ReactNode }> = [{ href: "/admin/users", label: "Users", icon: <UsersIcon /> }];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/receipts") return pathname === "/receipts" || (pathname.startsWith("/receipts/") && pathname !== "/receipts/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ variant, isAdmin }: { variant: "side" | "top"; isAdmin: boolean }) {
  const pathname = usePathname();
  const links = (isAdmin ? [...ITEMS, ...ADMIN_ITEMS] : ITEMS).map((i) => (
    <Link key={i.href} href={i.href} aria-current={isActive(pathname, i.href) ? "page" : undefined} aria-label={i.label} title={i.label}>
      {variant === "side" ? i.icon : null}
      <span className="label">{i.label}</span>
    </Link>
  ));
  return variant === "side" ? (
    <nav className="nav" aria-label="Main">
      {links}
    </nav>
  ) : (
    <nav className="topbar-links" aria-label="Main">
      {links}
    </nav>
  );
}
