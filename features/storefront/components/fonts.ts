import { Jost, Libre_Caslon_Text } from "next/font/google";

// Sirius: a geometric sans for the list, a bookish serif for the store's name.
// Shared by the shop shell and the static 404.
const text = Jost({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--sf-text", display: "swap" });
const name = Libre_Caslon_Text({ subsets: ["latin"], weight: ["700"], variable: "--sf-nameface", display: "swap" });

export const storefrontFonts = `${text.variable} ${name.variable}`;
