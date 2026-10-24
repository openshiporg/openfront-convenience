import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import { keystoneContext } from "@/features/keystone/context";
import {
  conveniencePublicStorefrontProjection,
  type PublicStorefrontProjection,
} from "@/features/keystone/mutations/publicStorefrontProjection";

export const getPublicStorefrontProjection = cache(
  async (): Promise<PublicStorefrontProjection> => {
    // Request time only: the database isn't reachable during `next build`, and a
    // prerendered page would bake in whatever the build saw.
    await connection();
    try {
      return await conveniencePublicStorefrontProjection(
        null,
        {},
        keystoneContext,
      );
    } catch (error) {
      console.error("Public storefront projection failed", {
        kind: error instanceof Error ? error.name : "unknown",
      });
      return {
        state: "unavailable",
        mode: null,
        identity: null,
        location: null,
        categories: [],
        fuelPrices: [],
      };
    }
  },
);
