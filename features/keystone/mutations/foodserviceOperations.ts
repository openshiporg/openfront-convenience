import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import {
  addQuantities,
  compareQuantities,
  normalizeQuantity,
  quantityToScaledInteger,
  scaledIntegerToQuantity,
} from "../lib/quantity";
import { assertRecipeUnitContract } from "../lib/recipeUnitPolicy";
import { foodserviceWasteLocationWhere } from "../lib/foodserviceWasteLocationScope";
import { consumeInventoryLots } from "./inventoryPosting";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function multiplyQuantityRatio(
  quantity: string,
  multiplier: string,
  divisor: string,
): string {
  const quantityScaled = quantityToScaledInteger(quantity);
  const multiplierScaled = quantityToScaledInteger(multiplier);
  const divisorScaled = quantityToScaledInteger(divisor);
  if (divisorScaled <= 0n)
    throw new Error("Recipe yield must be greater than zero");
  const numerator = quantityScaled * multiplierScaled;
  const roundedScaled = (numerator + divisorScaled / 2n) / divisorScaled;
  return scaledIntegerToQuantity(roundedScaled);
}

export async function configurePreparedFoodRecipe(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      name: string;
      code: string;
      outputVariantId: string;
      yieldQuantity: string;
      yieldUnit: string;
      inputVariantId: string;
      ingredientName: string;
      ingredientQuantity: string;
      ingredientUnit: string;
      instructions?: string | null;
      allergenNotes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const name = args.input.name.trim();
  const code = args.input.code.trim().toLowerCase();
  const yieldQuantity = normalizeQuantity(args.input.yieldQuantity);
  const ingredientQuantity = normalizeQuantity(args.input.ingredientQuantity);
  if (!name || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(code))
    throw new Error("Recipe name and lowercase code are required");
  if (
    compareQuantities(yieldQuantity, "0") <= 0 ||
    compareQuantities(ingredientQuantity, "0") <= 0
  ) {
    throw new Error("Recipe yield and ingredient quantity must be positive");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePreparedFood",
    scope: "configurePreparedFoodRecipe",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, code, yieldQuantity, ingredientQuantity },
    resourceType: "Recipe",
    action: "recipe.configure",
    execute: async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`recipe-definition:${args.input.businessId}:${code}`}))::text AS "locked"`,
      );
      const [store, outputVariant, inputVariant] = await Promise.all([
        transaction.store.findFirst({
          where: {
            id: args.input.storeId,
            businessId: args.input.businessId,
            status: "active",
          },
        }),
        transaction.productVariant.findFirst({
          where: {
            id: args.input.outputVariantId,
            businessId: args.input.businessId,
            status: "active",
          },
        }),
        transaction.productVariant.findFirst({
          where: {
            id: args.input.inputVariantId,
            businessId: args.input.businessId,
            status: "active",
            trackInventory: true,
          },
        }),
      ]);
      if (!store || !outputVariant || !inputVariant)
        throw new Error(
          "Recipe store, output, or inventory ingredient is invalid",
        );
      const yieldUnit = args.input.yieldUnit.trim() || "each";
      const ingredientUnit =
        args.input.ingredientUnit.trim() || inputVariant.unitOfMeasure;
      if (yieldUnit !== outputVariant.unitOfMeasure) {
        throw new Error(
          "Recipe yield unit must match the output variant unit; unit conversion is not supported",
        );
      }
      if (ingredientUnit !== inputVariant.unitOfMeasure) {
        throw new Error(
          "Recipe ingredient unit must match its inventory variant; unit conversion is not supported",
        );
      }
      const lookupKey = `${args.input.businessId}:recipe:${code}`;
      const existing = await transaction.recipe.findUnique({
        where: { lookupKey },
      });
      if (existing) {
        await transaction.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`recipe:${existing.id}`}))::text AS "locked"`,
        );
        const openBatches = await transaction.prepBatch.count({
          where: {
            recipeId: existing.id,
            status: { in: ["planned", "in_progress"] },
          },
        });
        if (openBatches > 0)
          throw new Error(
            "Recipe cannot change while a prep batch is planned or in progress",
          );
      }
      const recipe = existing
        ? await transaction.recipe.update({
            where: { id: existing.id },
            data: {
              name,
              outputVariantId: outputVariant.id,
              status: "active",
              active: true,
              yieldQuantity,
              yieldUnit,
              instructions: args.input.instructions?.trim() || "",
              allergenNotes: args.input.allergenNotes?.trim() || "",
            },
          })
        : await transaction.recipe.create({
            data: {
              businessId: args.input.businessId,
              name,
              code,
              lookupKey,
              outputVariantId: outputVariant.id,
              status: "active",
              active: true,
              yieldQuantity,
              yieldUnit,
              instructions: args.input.instructions?.trim() || "",
              allergenNotes: args.input.allergenNotes?.trim() || "",
            },
          });
      const ingredient = await transaction.recipeIngredient.findFirst({
        where: {
          businessId: args.input.businessId,
          recipeId: recipe.id,
          inputVariantId: inputVariant.id,
        },
      });
      if (ingredient) {
        await transaction.recipeIngredient.update({
          where: { id: ingredient.id },
          data: {
            nameSnapshot:
              args.input.ingredientName.trim() || inputVariant.title,
            quantity: ingredientQuantity,
            unit: ingredientUnit,
          },
        });
      } else {
        await transaction.recipeIngredient.create({
          data: {
            businessId: args.input.businessId,
            recipeId: recipe.id,
            inputVariantId: inputVariant.id,
            nameSnapshot:
              args.input.ingredientName.trim() || inputVariant.title,
            quantity: ingredientQuantity,
            unit: ingredientUnit,
            wasteBasisPoints: 0,
            optional: false,
          },
        });
      }
      return { id: recipe.id, status: recipe.status, reference: recipe.code };
    },
  });
}

export async function startPrepBatch(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      recipeId: string;
      employeeId: string;
      quantityPlanned: string;
      expiresAt?: string | null;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const quantityPlanned = normalizeQuantity(args.input.quantityPlanned);
  if (compareQuantities(quantityPlanned, "0") <= 0)
    throw new Error("Planned prep quantity must be positive");
  const expiresAt = args.input.expiresAt
    ? new Date(args.input.expiresAt)
    : null;
  if (expiresAt && !Number.isFinite(expiresAt.getTime()))
    throw new Error("Prep expiry must be a valid timestamp");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePreparedFood",
    scope: "startPrepBatch",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, quantityPlanned, expiresAt },
    resourceType: "PrepBatch",
    action: "prep_batch.start",
    execute: async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`recipe:${args.input.recipeId}`}))::text AS "locked"`,
      );
      const [recipe, employee] = await Promise.all([
        transaction.recipe.findFirst({
          where: {
            id: args.input.recipeId,
            businessId: args.input.businessId,
            status: "active",
            active: true,
          },
          include: {
            outputVariant: { select: { unitOfMeasure: true } },
            ingredients: {
              include: { inputVariant: { select: { unitOfMeasure: true } } },
            },
          },
        }),
        transaction.employee.findFirst({
          where: {
            id: args.input.employeeId,
            businessId: args.input.businessId,
            status: "active",
            stores: { some: { id: args.input.storeId } },
          },
        }),
      ]);
      if (!recipe || !employee)
        throw new Error("Active recipe or preparing employee not found");
      assertRecipeUnitContract(recipe);
      const now = new Date();
      const batch = await transaction.prepBatch.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          batchNumber: `PREP-${randomUUID()}`,
          recipeId: recipe.id,
          status: "in_progress",
          quantityPlanned,
          quantityMade: "0.0000",
          preparedById: employee.id,
          startedAt: now,
          expiresAt,
          notes: args.input.notes?.trim() || "",
        },
      });
      return {
        id: batch.id,
        status: batch.status,
        reference: batch.batchNumber,
      };
    },
  });
}

export async function completePrepBatch(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      prepBatchId: string;
      locationId: string;
      employeeId: string;
      quantityMade: string;
      lotNumber?: string | null;
      expiresAt?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const quantityMade = normalizeQuantity(args.input.quantityMade);
  if (compareQuantities(quantityMade, "0") <= 0) {
    throw new Error("Prepared quantity must be greater than zero");
  }
  if (
    args.input.expiresAt &&
    !Number.isFinite(new Date(args.input.expiresAt).getTime())
  ) {
    throw new Error("Prep-batch expiry must be a valid ISO timestamp");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePreparedFood",
    scope: "completePrepBatch",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, quantityMade },
    resourceType: "PrepBatch",
    action: "prep_batch.complete",
    execute: async (transaction, idempotencyId) => {
      const batch = await transaction.prepBatch.findFirst({
        where: {
          id: args.input.prepBatchId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: { in: ["planned", "in_progress"] },
        },
        include: {
          recipe: {
            include: {
              outputVariant: true,
              ingredients: { include: { inputVariant: true } },
            },
          },
        },
      });
      if (
        !batch?.recipe ||
        batch.recipe.status !== "active" ||
        !batch.recipe.outputVariant
      ) {
        throw new Error(
          "Active prep batch recipe and output variant are required",
        );
      }
      const recipe = batch.recipe;
      assertRecipeUnitContract(recipe);
      const outputVariant = recipe.outputVariant;
      if (!outputVariant)
        throw new Error("Prep recipe output variant is missing");
      if (
        recipe.businessId !== args.input.businessId ||
        outputVariant.businessId !== args.input.businessId ||
        recipe.ingredients.some(
          (ingredient) =>
            ingredient.businessId !== args.input.businessId ||
            (ingredient.inputVariant &&
              ingredient.inputVariant.businessId !== args.input.businessId),
        )
      ) {
        throw new Error(
          "Prep recipe relationships do not resolve to one business",
        );
      }

      const location = await transaction.inventoryLocation.findFirst({
        where: {
          id: args.input.locationId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "active",
        },
      });
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!location || !employee)
        throw new Error("Prep location or employee is invalid for this store");

      const now = new Date();
      let actualCostCents = 0;
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.inputVariant) {
          if (ingredient.optional) continue;
          throw new Error(
            `Recipe ingredient ${ingredient.nameSnapshot} has no live variant`,
          );
        }
        const required = multiplyQuantityRatio(
          ingredient.quantity.toString(),
          quantityMade,
          recipe.yieldQuantity.toString(),
        );
        const lookupKey = `${location.id}:${ingredient.inputVariant.id}`;
        const stock = await transaction.stockLevel.findUnique({
          where: { lookupKey },
        });
        if (!stock) {
          if (ingredient.optional) continue;
          throw new Error(
            `No stock level for recipe ingredient ${ingredient.nameSnapshot}`,
          );
        }
        const balanceAfter = addQuantities(
          stock.onHandQuantity.toString(),
          `-${required}`,
        );
        if (
          !ingredient.inputVariant.allowNegativeInventory &&
          compareQuantities(balanceAfter, "0") < 0
        ) {
          if (ingredient.optional) continue;
          throw new Error(
            `Insufficient inventory for recipe ingredient ${ingredient.nameSnapshot}`,
          );
        }
        await transaction.stockLevel.update({
          where: { id: stock.id },
          data: { onHandQuantity: balanceAfter },
        });
        const lotSegments = await consumeInventoryLots(transaction, {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          locationId: location.id,
          variantId: ingredient.inputVariant.id,
          quantity: required,
        });
        if (
          lotSegments.some((segment) => !segment.lotId) &&
          !ingredient.inputVariant.allowNegativeInventory
        ) {
          throw new Error(
            `Ingredient ${ingredient.nameSnapshot} exceeds available FIFO lot quantity`,
          );
        }
        let runningBalance = stock.onHandQuantity.toString();
        for (const segment of lotSegments) {
          const segmentCostCents =
            segment.unitCostCents ?? ingredient.inputVariant.costCents ?? 0;
          const segmentExtendedCost = Number(
            (BigInt(segmentCostCents) *
              quantityToScaledInteger(segment.quantity) +
              5_000n) /
              10_000n,
          );
          actualCostCents += segmentExtendedCost;
          if (!Number.isSafeInteger(actualCostCents))
            throw new Error("Prep actual cost exceeds safe integer range");
          runningBalance = addQuantities(
            runningBalance,
            `-${segment.quantity}`,
          );
          await transaction.inventoryLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              stockLevelId: stock.id,
              locationId: location.id,
              variantId: ingredient.inputVariant.id,
              lotId: segment.lotId,
              type: "production_input",
              quantityDelta: `-${segment.quantity}`,
              balanceAfter: runningBalance,
              unitCostCents: segmentCostCents,
              reason: `Ingredient consumed by ${batch.batchNumber}`,
              sourceType: "PrepBatch",
              sourceId: batch.id,
              actorId: employee.id,
              idempotencyId,
              occurredAt: now,
            },
          });
        }
        if (runningBalance !== balanceAfter) {
          throw new Error(
            "Prep ingredient lot allocation did not reconcile to stock balance",
          );
        }
      }

      const outputLookupKey = `${location.id}:${outputVariant.id}`;
      const outputStock = await transaction.stockLevel.findUnique({
        where: { lookupKey: outputLookupKey },
      });
      const outputBalance = addQuantities(
        outputStock?.onHandQuantity.toString() ?? "0.0000",
        quantityMade,
      );
      const updatedOutputStock = outputStock
        ? await transaction.stockLevel.update({
            where: { id: outputStock.id },
            data: { onHandQuantity: outputBalance },
          })
        : await transaction.stockLevel.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              locationId: location.id,
              variantId: outputVariant.id,
              lookupKey: outputLookupKey,
              onHandQuantity: outputBalance,
              reservedQuantity: "0.0000",
              parQuantity: "0.0000",
              reorderPoint: "0.0000",
              reorderQuantity: "0.0000",
            },
          });

      const quantityMadeScaled = quantityToScaledInteger(quantityMade);
      const outputUnitCostCents = Number(
        (BigInt(actualCostCents) * 10_000n + quantityMadeScaled / 2n) /
          quantityMadeScaled,
      );
      if (!Number.isSafeInteger(outputUnitCostCents))
        throw new Error("Prep unit cost exceeds safe integer range");
      const effectiveExpiresAt = args.input.expiresAt
        ? new Date(args.input.expiresAt)
        : batch.expiresAt;
      const lotNumber = args.input.lotNumber?.trim() || `PREP-${randomUUID()}`;
      const lot = await transaction.inventoryLot.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          locationId: location.id,
          variantId: outputVariant.id,
          lotNumber,
          lookupKey: `${location.id}:${outputVariant.id}:${lotNumber}`,
          quantityReceived: quantityMade,
          quantityRemaining: quantityMade,
          unitCostCents: outputUnitCostCents,
          receivedAt: now,
          expiresAt: effectiveExpiresAt,
          status: "active",
          metadata: { prepBatchId: batch.id },
        },
      });

      await transaction.inventoryLedgerEntry.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          stockLevelId: updatedOutputStock.id,
          locationId: location.id,
          variantId: outputVariant.id,
          lotId: lot.id,
          type: "production_output",
          quantityDelta: quantityMade,
          balanceAfter: outputBalance,
          unitCostCents: outputUnitCostCents,
          reason: `Output from ${batch.batchNumber}`,
          sourceType: "PrepBatch",
          sourceId: batch.id,
          actorId: employee.id,
          idempotencyId,
          occurredAt: now,
        },
      });

      const updated = await transaction.prepBatch.update({
        where: { id: batch.id },
        data: {
          status: "completed",
          quantityMade,
          actualCostCents,
          outputLotId: lot.id,
          preparedById: employee.id,
          startedAt: batch.startedAt ?? now,
          completedAt: now,
          expiresAt: effectiveExpiresAt,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.batchNumber,
      };
    },
  });
}

export async function recordWasteEvent(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      locationId: string;
      variantId: string;
      lotId?: string | null;
      prepBatchId?: string | null;
      employeeId: string;
      reason:
        | "expired"
        | "spoilage"
        | "preparation_error"
        | "overproduction"
        | "quality"
        | "damaged"
        | "other";
      quantity: string;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const quantity = normalizeQuantity(args.input.quantity);
  if (compareQuantities(quantity, "0") <= 0)
    throw new Error("Waste quantity must be positive");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePreparedFood",
    scope: "recordWasteEvent",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, quantity },
    resourceType: "WasteEvent",
    action: "waste.record",
    execute: async (transaction, idempotencyId) => {
      const location = await transaction.inventoryLocation.findFirst({
        where: foodserviceWasteLocationWhere(args.input),
      });
      const variant = await transaction.productVariant.findFirst({
        where: { id: args.input.variantId, businessId: args.input.businessId },
      });
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!location || !variant || !employee)
        throw new Error("Waste location, variant, or employee is invalid");

      let effectiveLotId = args.input.lotId ?? null;
      if (args.input.prepBatchId) {
        const batch = await transaction.prepBatch.findFirst({
          where: {
            id: args.input.prepBatchId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
          },
        });
        if (!batch)
          throw new Error("Prep batch not found for this business and store");
        if (
          effectiveLotId &&
          batch.outputLotId &&
          effectiveLotId !== batch.outputLotId
        ) {
          throw new Error("Waste lot does not match the prep batch output lot");
        }
        effectiveLotId ??= batch.outputLotId;
      }

      const lot = effectiveLotId
        ? await transaction.inventoryLot.findFirst({
            where: {
              id: effectiveLotId,
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              locationId: location.id,
              variantId: variant.id,
              status: "active",
            },
          })
        : null;
      if (effectiveLotId && !lot) {
        throw new Error("Waste lot is invalid for this location and variant");
      }
      if (
        lot &&
        compareQuantities(lot.quantityRemaining.toString(), quantity) < 0
      ) {
        throw new Error("Waste quantity exceeds the selected lot quantity");
      }

      const lookupKey = `${location.id}:${variant.id}`;
      const stock = await transaction.stockLevel.findUnique({
        where: { lookupKey },
      });
      if (!stock)
        throw new Error("No stock level exists for waste variant and location");
      const balanceAfter = addQuantities(
        stock.onHandQuantity.toString(),
        `-${quantity}`,
      );
      if (
        !variant.allowNegativeInventory &&
        compareQuantities(balanceAfter, "0") < 0
      ) {
        throw new Error("Waste quantity exceeds on-hand inventory");
      }
      await transaction.stockLevel.update({
        where: { id: stock.id },
        data: { onHandQuantity: balanceAfter },
      });
      const lotSegments = lot
        ? [{ lotId: lot.id, quantity, unitCostCents: lot.unitCostCents }]
        : await consumeInventoryLots(transaction, {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            locationId: location.id,
            variantId: variant.id,
            quantity,
            includeExpired: true,
          });
      if (lot) {
        const lotBalance = addQuantities(
          lot.quantityRemaining.toString(),
          `-${quantity}`,
        );
        await transaction.inventoryLot.update({
          where: { id: lot.id },
          data: {
            quantityRemaining: lotBalance,
            status:
              compareQuantities(lotBalance, "0") === 0 ? "consumed" : "active",
          },
        });
      }
      if (
        lotSegments.some((segment) => !segment.lotId) &&
        !variant.allowNegativeInventory
      ) {
        throw new Error("Waste quantity exceeds available FIFO lot quantity");
      }

      const now = new Date();
      const costCents = lotSegments.reduce((sum, segment) => {
        const unitCost = segment.unitCostCents ?? variant.costCents ?? 0;
        return (
          sum +
          Number(
            (BigInt(unitCost) * quantityToScaledInteger(segment.quantity) +
              5_000n) /
              10_000n,
          )
        );
      }, 0);
      if (!Number.isSafeInteger(costCents))
        throw new Error("Waste cost exceeds safe integer range");
      const waste = await transaction.wasteEvent.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          eventNumber: `WASTE-${randomUUID()}`,
          variantId: variant.id,
          lotId: lotSegments.length === 1 ? lotSegments[0].lotId : null,
          prepBatchId: args.input.prepBatchId ?? null,
          reason: args.input.reason,
          quantity,
          costCents,
          loggedById: employee.id,
          occurredAt: now,
          notes: args.input.notes?.trim() || "",
          idempotencyId,
          metadata: {
            lotSegments: lotSegments.map((segment) => ({
              lotId: segment.lotId,
              quantity: segment.quantity,
            })),
          },
        },
      });
      let runningBalance = stock.onHandQuantity.toString();
      for (const segment of lotSegments) {
        runningBalance = addQuantities(runningBalance, `-${segment.quantity}`);
        await transaction.inventoryLedgerEntry.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            stockLevelId: stock.id,
            locationId: location.id,
            variantId: variant.id,
            lotId: segment.lotId,
            type: "waste",
            quantityDelta: `-${segment.quantity}`,
            balanceAfter: runningBalance,
            unitCostCents: segment.unitCostCents ?? variant.costCents,
            reason: `Waste ${waste.eventNumber}: ${args.input.reason}`,
            sourceType: "WasteEvent",
            sourceId: waste.id,
            wasteEventId: waste.id,
            actorId: employee.id,
            idempotencyId,
            occurredAt: now,
          },
        });
      }
      if (runningBalance !== balanceAfter)
        throw new Error(
          "Waste lot allocation did not reconcile to stock balance",
        );
      return { id: waste.id, status: "posted", reference: waste.eventNumber };
    },
  });
}
