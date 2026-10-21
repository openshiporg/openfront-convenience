export const STOREFRONT_THEME_PRESETS = [
  {
    id: "forest-amber",
    label: "Forest and amber",
    primaryColor: "#153F34",
    accentColor: "#F4B942",
  },
  {
    id: "navy-coral",
    label: "Navy and coral",
    primaryColor: "#1F3A5F",
    accentColor: "#EF8A70",
  },
  {
    id: "plum-rose",
    label: "Plum and rose",
    primaryColor: "#4A315D",
    accentColor: "#E9A0B8",
  },
  {
    id: "slate-cyan",
    label: "Slate and cyan",
    primaryColor: "#263238",
    accentColor: "#71D1D8",
  },
  {
    id: "aubergine-gold",
    label: "Aubergine and gold",
    primaryColor: "#3F2A44",
    accentColor: "#E0B65A",
  },
  {
    id: "ink-lime",
    label: "Ink and lime",
    primaryColor: "#242424",
    accentColor: "#C6DC78",
  },
] as const;

export type StorefrontThemePreset = (typeof STOREFRONT_THEME_PRESETS)[number];

export function getStorefrontThemePreset(
  id: string,
): StorefrontThemePreset | null {
  return STOREFRONT_THEME_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function findStorefrontThemePreset(
  primaryColor: string,
  accentColor: string,
): StorefrontThemePreset | null {
  const primary = primaryColor.trim().toUpperCase();
  const accent = accentColor.trim().toUpperCase();
  return (
    STOREFRONT_THEME_PRESETS.find(
      (preset) =>
        preset.primaryColor === primary && preset.accentColor === accent,
    ) ?? null
  );
}
