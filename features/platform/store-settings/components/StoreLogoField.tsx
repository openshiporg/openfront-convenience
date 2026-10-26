"use client";

import { useState } from "react";

import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from "../lib/store-logo";
import { LogoPicker } from "./LogoPicker";

export function StoreLogoField({ initialIcon, initialColor }: { initialIcon: string; initialColor: string }) {
  const [logoIcon, setLogoIcon] = useState(initialIcon || DEFAULT_STORE_LOGO_ICON);
  const [logoColor, setLogoColor] = useState(normalizeStoreLogoColor(initialColor));
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-md border bg-muted/30 p-4 sm:col-span-2">
      <legend className="sr-only">Logo</legend>
      <input type="hidden" name="logoIcon" value={logoIcon} />
      <input type="hidden" name="logoColor" value={logoColor} />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
        <div
          className="flex size-16 items-center justify-center overflow-hidden rounded-md border bg-background p-2.5 [&>svg]:block [&>svg]:size-full"
          style={{ filter: `hue-rotate(${logoColor}deg)` }}
          dangerouslySetInnerHTML={{ __html: logoIcon }}
        />
        <LogoPicker value={logoIcon} hue={logoColor} onChange={setLogoIcon} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12px] font-medium text-muted-foreground">Colour</p>
          <span className="font-mono text-xs text-muted-foreground">{logoColor}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="359"
          value={logoColor}
          onChange={(event) => setLogoColor(event.target.value)}
          className="mt-3 h-6 w-full accent-foreground max-sm:h-10"
          aria-label="Logo hue rotation"
        />
      </div>
    </fieldset>
  );
}
