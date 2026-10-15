import type { ReactNode } from "react";

/** Stroke icons, 24px grid, drawn to inherit the text colour. */
function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const TodayIcon = () => (
  <Icon>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);
export const NewReceiptIcon = () => (
  <Icon>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 12v6M9 15h6" />
  </Icon>
);
export const ReceiptsIcon = () => (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);
export const BooksIcon = () => (
  <Icon>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Icon>
);
export const DepositsIcon = () => (
  <Icon>
    <path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2.5 10 12 3l9.5 7z" />
  </Icon>
);
export const ReportsIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </Icon>
);
export const PaletteIcon = () => (
  <Icon>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-.95-.5-1.3-.3-.35-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4A3.6 3.6 0 0 0 21 11C20.6 6.6 16.7 3 12 3z" />
    <path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" />
  </Icon>
);
export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
export const MoonIcon = () => (
  <Icon>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
  </Icon>
);
export const CollapseIcon = () => (
  <Icon>
    <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
  </Icon>
);
export const ExpandIcon = () => (
  <Icon>
    <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
  </Icon>
);
export const UsersIcon = () => (
  <Icon>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);
