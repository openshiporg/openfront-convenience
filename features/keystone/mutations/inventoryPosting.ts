import { Prisma } from "@prisma/client";

import { planLotConsumption } from "../lib/inventoryLotPolicy";
import { addQuantities, compareQuantities } from "../lib/quantity";

export type InventoryLotSegment = {
  lotId: string | null;
  quantity: string;
  unitCostCents: number | null;
};

export async function consumeInventoryLots(
  transaction: Prisma.TransactionClient,
  {
    businessId,
    storeId,
    locationId,
    variantId,
    quantity,
    includeExpired = false,
  }: {
    businessId: string;
    storeId: string;
    locationId: string;
    variantId: string;
    quantity: string;
    includeExpired?: boolean;
  },
): Promise<InventoryLotSegment[]> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`inventory:${locationId}:${variantId}`}))::text AS "locked"`,
  );
  const lots = await transaction.inventoryLot.findMany({
    where: {
      businessId,
      storeId,
      locationId,
      variantId,
      status: "active",
      quantityRemaining: { gt: "0.0000" },
      ...(includeExpired
        ? {}
        : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }),
    },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
  });
  const plan = planLotConsumption(
    quantity,
    lots.map((lot) => ({
      id: lot.id,
      quantityRemaining: lot.quantityRemaining.toString(),
    })),
  );

  for (const allocation of plan.allocations) {
    const lot = lots.find((entry) => entry.id === allocation.lotId)!;
    const quantityRemaining = addQuantities(
      lot.quantityRemaining.toString(),
      `-${allocation.quantity}`,
    );
    await transaction.inventoryLot.update({
      where: { id: lot.id },
      data: {
        quantityRemaining,
        status:
          compareQuantities(quantityRemaining, "0") === 0
            ? "consumed"
            : "active",
      },
    });
  }

  return [
    ...plan.allocations.map((allocation) => ({
      lotId: allocation.lotId,
      quantity: allocation.quantity,
      unitCostCents:
        lots.find((lot) => lot.id === allocation.lotId)?.unitCostCents ?? null,
    })),
    ...(compareQuantities(plan.unallocatedQuantity, "0") > 0
      ? [
          {
            lotId: null,
            quantity: plan.unallocatedQuantity,
            unitCostCents: null,
          },
        ]
      : []),
  ];
}
