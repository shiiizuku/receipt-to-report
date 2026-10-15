import { describe, expect, it } from "vitest";
import { contrast } from "@/lib/color";
import { BOOT_SCRIPT, STORAGE, THEMES, themeCss, type Palette } from "@/lib/themes";

/** 4.5:1 for text and 3:1 for field borders, the focus ring and the active-nav underline, in every theme and mode. */
const TEXT: Array<[keyof Palette, keyof Palette]> = [
  ["ink", "ground"], ["ink", "surface"], ["ink2", "ground"], ["ink2", "surface"], ["ink3", "ground"], ["ink3", "surface"], ["ink3", "surface2"],
  ["onAccent", "accent"], ["onAccent", "accentHover"], ["accent", "ground"], ["accent", "surface"],
  ["barInk", "bar"], ["barMuted", "bar"], ["barInk", "barPill"], ["barMuted", "barPill"],
  ["goldText", "goldTint"], ["goldText", "ground"], ["goldText", "surface"],
];
const NON_TEXT: Array<[keyof Palette, keyof Palette]> = [
  ["field", "ground"], ["field", "surface"], ["accent", "ground"], ["barUnderline", "bar"],
];

describe("theme palettes", () => {
  for (const t of THEMES) {
    for (const mode of ["light", "dark"] as const) {
      const p = t[mode];
      it(`${t.name} ${mode}: text pairs reach 4.5:1`, () => {
        for (const [fg, bg] of TEXT) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      });
      it(`${t.name} ${mode}: borders, focus ring and nav underline reach 3:1`, () => {
        // The field border sits on the white (light) or surface (dark) field fill as well.
        const fill = mode === "light" ? "#FFFFFF" : p.surface;
        expect(contrast(p.field, fill), "field on its fill").toBeGreaterThanOrEqual(3);
        for (const [fg, bg] of NON_TEXT) expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it("has eight themes with unique ids, and Neutral first", () => {
    expect(THEMES).toHaveLength(8);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(8);
    expect(THEMES[0].id).toBe("neutral");
  });

  it("writes light, system-dark and forced-dark rules for each theme", () => {
    const css = themeCss();
    for (const t of THEMES) {
      expect(css).toContain(`:root[data-theme="${t.id}"]{`);
      expect(css).toContain(`:root[data-theme="${t.id}"]:not([data-mode="light"])`);
      expect(css).toContain(`:root[data-theme="${t.id}"][data-mode="dark"]`);
    }
  });
});

describe("boot script", () => {
  function run(stored: Record<string, string>, throwOnRead = false) {
    const attrs: Record<string, string> = {};
    const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    const storage = {
      getItem: (k: string) => {
        if (throwOnRead) throw new Error("blocked");
        return stored[k] ?? null;
      },
    };
    new Function("document", "localStorage", BOOT_SCRIPT)(doc, storage);
    return attrs;
  }

  it("applies the saved theme, colour mode and collapsed sidebar", () => {
    expect(run({ [STORAGE.theme]: "sage", [STORAGE.mode]: "dark", [STORAGE.sidebar]: "collapsed" })).toEqual({
      "data-theme": "sage",
      "data-mode": "dark",
      "data-sidebar": "collapsed",
    });
  });

  it("follows the system when no mode is saved, and ignores unknown values", () => {
    expect(run({ [STORAGE.theme]: "bogus", [STORAGE.mode]: "system" })).toEqual({ "data-theme": "neutral" });
  });

  it("falls back to the default theme when storage is blocked", () => {
    expect(run({}, true)).toEqual({ "data-theme": "neutral" });
  });
});
