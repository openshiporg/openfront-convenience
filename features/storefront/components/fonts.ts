import { Barlow, Barlow_Condensed } from "next/font/google";

// Shelf-tag printing: Barlow Condensed 700 for prices and aisle signs, Barlow for
// everything else. Shared by the shop shell and the static 404.
const text = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--sf-text", display: "swap" });
const tag = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--sf-tagface", display: "swap" });

export const storefrontFonts = `${text.variable} ${tag.variable}`;
