"use client";

import { useState } from "react";

import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from "../lib/store-logo";
import { LogoPicker } from "./LogoPicker";

export function StoreLogoField({ initialIcon, initialColor }: { initialIcon: string; initialColor: string }) {
  const [logoIcon, setLogoIcon] = useState(initialIcon || DEFAULT_STORE_LOGO_ICON);
  const [logoColor, setLogoColor] = useState(normalizeStoreLogoColor(initialColor));
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-xl bg-muted/40 p-4 shadow-[inset_0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-inset ring-border/60 sm:col-span-2">
      <legend className="sr-only">Logo</legend>
      <input type="hidden" name="logoIcon" value={logoIcon} />
      <input type="hidden" name="logoColor" value={logoColor} />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
        <div
          className="flex size-16 items-center justify-center overflow-hidden rounded-xl bg-background p-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.12)] [&>svg]:block [&>svg]:size-full"
          style={{ filter: `hue-rotate(${logoColor}deg)` }}
          dangerouslySetInnerHTML={{ __html: logoIcon }}
        />
        <LogoPicker value={logoIcon} hue={logoColor} onChange={setLogoIcon} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Colour</p>
          <span className="font-mono text-xs text-muted-foreground">{logoColor}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="359"
          value={logoColor}
          onChange={(event) => setLogoColor(event.target.value)}
          className="mt-3 w-full accent-primary"
          aria-label="Logo hue rotation"
        />
      </div>
    </fieldset>
  );
}
