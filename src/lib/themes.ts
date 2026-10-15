import { hexToOklch, oklchToHex } from "./color";

/**
 * Civic Ledger themes. Each theme has a light and a dark palette; dark mode is a separate choice.
 * Neutral pastel, Sage pastel, Blush pastel and Civic Ledger are the approved palettes from the
 * design canvas. Stone grey, Slate grey, Cool mist and Warm sand follow the handoff spec: Neutral
 * with its greys moved to another hue and its primary moved to match, at Neutral's lightness.
 */
export interface Palette {
  ground: string; // page background
  surface: string; // cards, panels, popovers
  surface2: string; // table header, selected swatch
  hoverRow: string;
  line: string;
  line2: string;
  field: string; // input borders (3:1 against the ground)
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  gold: string;
  goldText: string;
  goldTint: string;
  bar: string; // sidebar
  barInk: string;
  barMuted: string;
  barPill: string;
  barLine: string;
  barAvatar: string;
  barUnderline: string;
}

export interface Theme {
  id: string;
  name: string;
  light: Palette;
  dark: Palette;
}

type Pal = Palette;
const P = (p: Pal): Pal => p;

const NEUTRAL_LIGHT = P({
  ground: "#F5F3EF", surface: "#FDFCFA", surface2: "#EEEBE5", hoverRow: "#F2EFE9", line: "#DDD8CF", line2: "#E9E5DE", field: "#928C80",
  ink: "#2D2A26", ink2: "#4F4A43", ink3: "#625C54", accent: "#527061", accentHover: "#4A6557", onAccent: "#FFFFFF",
  gold: "#C4A57A", goldText: "#7E6440", goldTint: "#F6EEDF",
  bar: "#E6E1D8", barInk: "#2D2A26", barMuted: "#5E584F", barPill: "#F5F2EC", barLine: "#C9C2B6", barAvatar: "#D6CFC3", barUnderline: "#527061",
});
const NEUTRAL_DARK = P({
  ground: "#191816", surface: "#22201D", surface2: "#2A2825", hoverRow: "#2D2A26", line: "#3B3732", line2: "#312E2A", field: "#706A61",
  ink: "#EDE9E3", ink2: "#CBC4BA", ink3: "#ABA398", accent: "#A9C4B5", accentHover: "#C4D9CD", onAccent: "#191816",
  gold: "#BFA06B", goldText: "#D8BE8E", goldTint: "#2F2A1F",
  bar: "#141311", barInk: "#EDE9E3", barMuted: "#ABA398", barPill: "#25231F", barLine: "#45403A", barAvatar: "#302D29", barUnderline: "#A9C4B5",
});

const SAGE_LIGHT = P({
  ground: "#F1F4F1", surface: "#FBFCFB", surface2: "#E8EEE9", hoverRow: "#EEF2EE", line: "#D3DDD6", line2: "#E3EAE5", field: "#819086",
  ink: "#22302A", ink2: "#43524A", ink3: "#56655D", accent: "#49745E", accentHover: "#3F6552", onAccent: "#FFFFFF",
  gold: "#BFA06B", goldText: "#7A6238", goldTint: "#F4EEDD",
  bar: "#DCE6DF", barInk: "#22302A", barMuted: "#4F5E56", barPill: "#F1F5F2", barLine: "#B5C4BA", barAvatar: "#C9D6CD", barUnderline: "#49745E",
});
const SAGE_DARK = P({
  ground: "#131A16", surface: "#1B241F", surface2: "#212C26", hoverRow: "#24302A", line: "#33433A", line2: "#2A3830", field: "#5F7166",
  ink: "#E7EEEA", ink2: "#BFCCC4", ink3: "#A0B0A6", accent: "#9CCDB2", accentHover: "#BCE0CB", onAccent: "#131A16",
  gold: "#BFA06B", goldText: "#D6BC88", goldTint: "#2C2A1D",
  bar: "#0F1512", barInk: "#E7EEEA", barMuted: "#A0B0A6", barPill: "#1D2822", barLine: "#3D4F44", barAvatar: "#28352D", barUnderline: "#9CCDB2",
});

const BLUSH_LIGHT = P({
  ground: "#F6F2F1", surface: "#FDFBFB", surface2: "#EFE8E7", hoverRow: "#F3EDEC", line: "#E0D5D3", line2: "#ECE4E2", field: "#988986",
  ink: "#2F2627", ink2: "#524546", ink3: "#66585A", accent: "#895C64", accentHover: "#714B53", onAccent: "#FFFFFF",
  gold: "#C4A57A", goldText: "#7E6440", goldTint: "#F6EEDF",
  bar: "#EADFE0", barInk: "#2F2627", barMuted: "#5F5153", barPill: "#F8F3F3", barLine: "#CDBDBE", barAvatar: "#DCCDCE", barUnderline: "#895C64",
});
const BLUSH_DARK = P({
  ground: "#1C1718", surface: "#252021", surface2: "#2D2728", hoverRow: "#312A2B", line: "#403637", line2: "#362E2F", field: "#76696B",
  ink: "#F0E8E9", ink2: "#D0C2C4", ink3: "#B1A1A4", accent: "#D9AAB2", accentHover: "#E8C6CB", onAccent: "#1C1718",
  gold: "#C4A57A", goldText: "#DCC296", goldTint: "#302921",
  bar: "#161213", barInk: "#F0E8E9", barMuted: "#B1A1A4", barPill: "#282223", barLine: "#4A3F41", barAvatar: "#342C2D", barUnderline: "#D9AAB2",
});

const CIVIC_LIGHT = P({
  ground: "#F3F5F2", surface: "#FBFCFA", surface2: "#EEF2EE", hoverRow: "#F0F4F0", line: "#CDD6CF", line2: "#E1E7E2", field: "#7F9186",
  ink: "#13291F", ink2: "#3D5248", ink3: "#4F6359", accent: "#1F6B45", accentHover: "#14502F", onAccent: "#FFFFFF",
  gold: "#B8892F", goldText: "#8A6420", goldTint: "#FBF4E2",
  bar: "#13291F", barInk: "#F3F5F2", barMuted: "#B9C7BE", barPill: "#22382D", barLine: "#4F6359", barAvatar: "#2F4A3C", barUnderline: "#D9B56A",
});
const CIVIC_DARK = P({
  ground: "#0E1A14", surface: "#16251D", surface2: "#1B2C23", hoverRow: "#1E3127", line: "#2B4236", line2: "#253A2F", field: "#587163",
  ink: "#E6EDE8", ink2: "#B3C4B9", ink3: "#9DB1A5", accent: "#8FD1A8", accentHover: "#B5E3C6", onAccent: "#0E1A14",
  gold: "#C9A052", goldText: "#D9B56A", goldTint: "#2E2715",
  bar: "#0A140F", barInk: "#E6EDE8", barMuted: "#9DB1A5", barPill: "#17271F", barLine: "#3A5246", barAvatar: "#22352B", barUnderline: "#D9B56A",
});

/** Move a Neutral grey to another hue, keeping its lightness and scaling its chroma. */
function retint(hex: string, hue: number, chromaScale: number): string {
  const o = hexToOklch(hex);
  return oklchToHex({ l: o.l, c: o.c * chromaScale, h: hue });
}

/**
 * Build one of the four extra neutrals. `anchors` are the values the handoff spec gives for the theme;
 * every other grey is Neutral's, moved to the anchor's hue at Neutral's lightness.
 */
function neutralVariant(
  base: Palette,
  anchors: { ground: string; surface: string; ink: string; field: string; line: string; bar: string; accent: string },
  accentHoverDelta: number,
): Palette {
  const g = hexToOklch(anchors.ground);
  const n = hexToOklch(base.ground);
  const hue = g.h;
  const scale = n.c > 0 ? g.c / n.c : 1;
  const grey = (hex: string) => retint(hex, hue, scale);
  const acc = hexToOklch(anchors.accent);
  return {
    ...base,
    ground: anchors.ground,
    surface: anchors.surface,
    surface2: grey(base.surface2),
    hoverRow: grey(base.hoverRow),
    line: anchors.line,
    line2: grey(base.line2),
    field: anchors.field,
    ink: anchors.ink,
    ink2: grey(base.ink2),
    ink3: grey(base.ink3),
    accent: anchors.accent,
    accentHover: oklchToHex({ ...acc, l: acc.l + accentHoverDelta }),
    bar: anchors.bar,
    barInk: anchors.ink,
    barMuted: grey(base.barMuted),
    barPill: grey(base.barPill),
    barLine: grey(base.barLine),
    barAvatar: grey(base.barAvatar),
    barUnderline: anchors.accent,
  };
}

export const THEMES: Theme[] = [
  { id: "neutral", name: "Neutral pastel", light: NEUTRAL_LIGHT, dark: NEUTRAL_DARK },
  {
    id: "stone",
    name: "Stone grey",
    light: neutralVariant(NEUTRAL_LIGHT, { ground: "#F4F3F2", surface: "#FCFCFB", ink: "#2B2B29", field: "#8E8C88", line: "#D9D9D5", bar: "#E2E2DE", accent: "#5C6B72" }, -0.03),
    dark: neutralVariant(NEUTRAL_DARK, { ground: "#181817", surface: "#21201F", ink: "#EDEBE8", field: "#6D6B67", line: "#3A3937", bar: "#131312", accent: "#B1BFC6" }, 0.05),
  },
  {
    id: "slate",
    name: "Slate grey",
    light: neutralVariant(NEUTRAL_LIGHT, { ground: "#F0F4F8", surface: "#FBFCFE", ink: "#282B2F", field: "#848D99", line: "#D3D9E2", bar: "#DBE2EB", accent: "#516A87" }, -0.03),
    dark: neutralVariant(NEUTRAL_DARK, { ground: "#17181A", surface: "#1E2124", ink: "#E9EBEE", field: "#68707B", line: "#34383E", bar: "#121315", accent: "#A7BFDB" }, 0.05),
  },
  {
    id: "mist",
    name: "Cool mist",
    light: neutralVariant(NEUTRAL_LIGHT, { ground: "#F0F4F5", surface: "#FAFDFD", ink: "#272C2D", field: "#7E8E90", line: "#D0DBDD", bar: "#D9E4E6", accent: "#487072" }, -0.03),
    dark: neutralVariant(NEUTRAL_DARK, { ground: "#161919", surface: "#1E2122", ink: "#E8EDEE", field: "#657274", line: "#313839", bar: "#111414", accent: "#A0C4C6" }, 0.05),
  },
  {
    id: "sand",
    name: "Warm sand",
    light: neutralVariant(NEUTRAL_LIGHT, { ground: "#F8F2EC", surface: "#FEFCF8", ink: "#2F2A23", field: "#998A77", line: "#E2D7C9", bar: "#EBE0D2", accent: "#835F49" }, -0.03),
    dark: neutralVariant(NEUTRAL_DARK, { ground: "#1A1815", surface: "#24201B", ink: "#EEE9E2", field: "#756A5B", line: "#3C362E", bar: "#151310", accent: "#D7B4A0" }, 0.05),
  },
  { id: "sage", name: "Sage pastel", light: SAGE_LIGHT, dark: SAGE_DARK },
  { id: "blush", name: "Blush pastel", light: BLUSH_LIGHT, dark: BLUSH_DARK },
  { id: "civic", name: "Civic Ledger", light: CIVIC_LIGHT, dark: CIVIC_DARK },
];

export const DEFAULT_THEME = "neutral";
export const THEME_IDS = THEMES.map((t) => t.id);

/** Status colours stay fixed in every theme so a status reads the same however the app is dressed. */
const SIGNALS_LIGHT = "--wait-bg:#F6E8C4;--wait-fg:#5E4710;--move-bg:#D8E5F3;--move-fg:#234A73;--done-bg:#D6ECDF;--done-fg:#1D5A3A;--closed-bg:#E4E6E2;--closed-fg:#4A514C;--danger:#7D1D17;--alert-bg:#F6D3CF;--alert-fg:#7D1D17;";
const SIGNALS_DARK = "--wait-bg:#3B3114;--wait-fg:#F0D58C;--move-bg:#1C3350;--move-fg:#AFCBEC;--done-bg:#17392A;--done-fg:#9FD6B4;--closed-bg:#2A302C;--closed-fg:#C3CAC5;--danger:#F4B4AC;--alert-bg:#4A1C17;--alert-fg:#F4B4AC;";

function vars(p: Palette, dark: boolean): string {
  return (
    `--ground:${p.ground};--card:${p.surface};--muted:${p.surface2};--hover:${p.hoverRow};--line:${p.line};--line2:${p.line2};--field:${p.field};` +
    `--fieldbg:${dark ? p.surface : "#FFFFFF"};--ink:${p.ink};--ink2:${p.ink2};--ink3:${p.ink3};--accent:${p.accent};--accent-h:${p.accentHover};--on-accent:${p.onAccent};` +
    `--seal:${p.gold};--seal-ink:${p.goldText};--seal-tint:${p.goldTint};--bar:${p.bar};--bar-ink:${p.barInk};--bar-muted:${p.barMuted};--bar-pill:${p.barPill};` +
    `--bar-line:${p.barLine};--bar-avatar:${p.barAvatar};--bar-underline:${p.barUnderline};` +
    (dark ? SIGNALS_DARK + "color-scheme:dark;" : SIGNALS_LIGHT + "color-scheme:light;")
  );
}

/**
 * CSS for every theme. `data-theme` picks the palette; `data-mode` is "light" or "dark" when the person
 * chose one, and absent when they follow the system setting.
 */
export function themeCss(): string {
  const out: string[] = [];
  for (const t of THEMES) {
    const sel = `:root[data-theme="${t.id}"]`;
    out.push(`${sel}{${vars(t.light, false)}}`);
    out.push(`@media (prefers-color-scheme:dark){${sel}:not([data-mode="light"]){${vars(t.dark, true)}}}`);
    out.push(`${sel}[data-mode="dark"]{${vars(t.dark, true)}}`);
  }
  return out.join("\n");
}

export const STORAGE = { theme: "r2r.theme.v1", mode: "r2r.mode.v1", sidebar: "r2r.sidebar.v1" } as const;

/**
 * Runs before first paint so the page never flashes the wrong theme or sidebar width.
 * Keep it free of anything that can throw: storage can be blocked.
 */
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage;
var t=s.getItem("${STORAGE.theme}");if(!t||${JSON.stringify(THEME_IDS)}.indexOf(t)<0)t="${DEFAULT_THEME}";
d.setAttribute("data-theme",t);
var m=s.getItem("${STORAGE.mode}");if(m==="light"||m==="dark")d.setAttribute("data-mode",m);
if(s.getItem("${STORAGE.sidebar}")==="collapsed")d.setAttribute("data-sidebar","collapsed");
}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}")}})();`;
