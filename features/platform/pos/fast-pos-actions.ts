"use server";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

export type FastPosCartLineSummary = {
  id: string;
  title: string;
  quantity: string;
  unitOfMeasure: string;
  unitPriceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export type FastPosCartSummary = {
  id: string;
  reference: string;
  status: string;
  totalCents: number;
  lineCount: number;
  lines: FastPosCartLineSummary[];
  linesLoaded: boolean;
};

export type FastPosResult = {
  ok: boolean;
  message: string;
  cart: FastPosCartSummary | null;
  saleId?: string | null;
};

export type FastPosOperationScope =
  "createPosCart" | "addPosCartLine" | "completePosSale";

export type FastPosOperationOutcome = {
  state: "not_found" | "processing" | "succeeded" | "unknown";
  retryable: boolean;
  id: string | null;
  status: string | null;
  reference: string | null;
};

type FastPosScope = {
  businessId: string;
  storeId: string;
  idempotencyKey: string;
};

function validScope(input: FastPosScope): boolean {
  return Boolean(
    input.businessId &&
    input.storeId &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(input.idempotencyKey),
  );
}

async function loadCart(
  scope: Pick<FastPosScope, "businessId" | "storeId">,
  cartId: string,
  includeLines = true,
): Promise<FastPosCartSummary | null> {
  const response = await keystoneClient<{
    cart: {
      id: string;
      cartNumber: string | null;
      status: string | null;
      totalCents: number | null;
      linesCount: number;
      business: { id: string } | null;
      store: { id: string } | null;
    } | null;
  }>(
    `
      query FastPosCart($id: ID!) {
        cart(where: { id: $id }) {
          id cartNumber status totalCents linesCount
          business { id }
          store { id }
        }
      }
    `,
    { id: cartId },
  );
  const cart = response.success ? response.data.cart : null;
  if (
    !cart ||
    cart.business?.id !== scope.businessId ||
    cart.store?.id !== scope.storeId
  ) {
    return null;
  }
  const lines: FastPosCartLineSummary[] = [];
  let linesLoaded = includeLines && cart.linesCount <= 250;
  if (includeLines && linesLoaded) {
    for (let skip = 0; skip < cart.linesCount; skip += 100) {
      const page = await keystoneClient<{
        cart: {
          lines: Array<{
            id: string;
            title: string | null;
            quantity: string | null;
            unitOfMeasure: string | null;
            unitPriceCents: number | null;
            discountCents: number | null;
            taxCents: number | null;
            totalCents: number | null;
          }>;
        } | null;
      }>(
        `
          query FastPosCartLines($id: ID!, $skip: Int!) {
            cart(where: { id: $id }) {
              lines(take: 100, skip: $skip, orderBy: [{ createdAt: asc }, { id: asc }]) {
                id title: titleSnapshot quantity unitOfMeasure
                unitPriceCents discountCents taxCents totalCents
              }
            }
          }
        `,
        { id: cartId, skip },
      );
      if (!page.success || !page.data.cart) {
        linesLoaded = false;
        break;
      }
      lines.push(
        ...page.data.cart.lines.map((line) => ({
          id: line.id,
          title: line.title || "Item",
          quantity: line.quantity || "?",
          unitOfMeasure: line.unitOfMeasure || "unit",
          unitPriceCents: line.unitPriceCents ?? 0,
          discountCents: line.discountCents ?? 0,
          taxCents: line.taxCents ?? 0,
          totalCents: line.totalCents ?? 0,
        })),
      );
      if (page.data.cart.lines.length === 0 && lines.length < cart.linesCount) {
        linesLoaded = false;
        break;
      }
    }
    if (lines.length !== cart.linesCount) linesLoaded = false;
  }
  return {
    id: cart.id,
    reference: cart.cartNumber || cart.id,
    status: cart.status || "unknown",
    totalCents: cart.totalCents ?? 0,
    lineCount: cart.linesCount,
    lines,
    linesLoaded,
  };
}

export async function fastReadPosOperationOutcome(input: {
  businessId: string;
  storeId: string;
  scope: FastPosOperationScope;
  idempotencyKey: string;
}): Promise<FastPosOperationOutcome> {
  if (!validScope(input)) {
    return {
      state: "unknown",
      retryable: false,
      id: null,
      status: null,
      reference: null,
    };
  }
  const response = await keystoneClient<{
    posOperationOutcome: FastPosOperationOutcome;
  }>(
    `
      query FastPosOperationOutcome($input: PosOperationOutcomeInput!) {
        posOperationOutcome(input: $input) {
          state retryable id status reference
        }
      }
    `,
    { input },
  );
  if (!response.success) {
    return {
      state: "unknown",
      retryable: false,
      id: null,
      status: null,
      reference: null,
    };
  }
  return response.data.posOperationOutcome;
}

export async function fastLoadPosCart(input: {
  businessId: string;
  storeId: string;
  cartId: string;
}): Promise<FastPosResult> {
  if (!input.businessId || !input.storeId || !input.cartId) {
    return { ok: false, message: "Select an open basket.", cart: null };
  }
  const cart = await loadCart(input, input.cartId);
  return {
    ok: Boolean(cart),
    message: cart
      ? `${cart.lineCount} line${cart.lineCount === 1 ? "" : "s"} · ${(cart.totalCents / 100).toFixed(2)}`
      : "Basket was not found.",
    cart,
  };
}

export async function fastCreatePosCart(input: {
  businessId: string;
  storeId: string;
  registerSessionId: string;
  cashierId: string;
  idempotencyKey: string;
}): Promise<FastPosResult> {
  if (!validScope(input) || !input.registerSessionId || !input.cashierId) {
    return {
      ok: false,
      message: "Choose an open till and cashier.",
      cart: null,
    };
  }
  const response = await keystoneClient<{
    createPosCart: { id: string; reference?: string | null };
  }>(
    `
      mutation FastCreatePosCart($input: CreatePosCartInput!) {
        createPosCart(input: $input) { id reference }
      }
    `,
    { input },
  );
  if (!response.success) {
    return {
      ok: false,
      message: response.error || "Basket could not be started.",
      cart: null,
    };
  }
  const cart = await loadCart(input, response.data.createPosCart.id);
  return {
    ok: Boolean(cart),
    message: cart
      ? `${cart.reference} is ready to scan.`
      : "Basket was not found.",
    cart,
  };
}

export async function fastAddPosLine(input: {
  businessId: string;
  storeId: string;
  cartId: string;
  barcode?: string | null;
  variantId?: string | null;
  quantity: string;
  idempotencyKey: string;
}): Promise<FastPosResult> {
  if (
    !validScope(input) ||
    !input.cartId ||
    (!input.barcode?.trim() && !input.variantId?.trim())
  ) {
    return {
      ok: false,
      message: "Select a basket and scan a barcode or choose an item.",
      cart: null,
    };
  }
  const response = await keystoneClient<{
    addPosCartLine: { id: string };
  }>(
    `
      mutation FastAddPosLine($input: AddPosCartLineInput!) {
        addPosCartLine(input: $input) { id }
      }
    `,
    {
      input: {
        ...input,
        barcode: input.barcode?.trim() || null,
        variantId: input.variantId?.trim() || null,
      },
    },
  );
  const cart = await loadCart(input, input.cartId);
  if (!response.success) {
    return {
      ok: false,
      message: response.error || "Item could not be added.",
      cart,
    };
  }
  return {
    ok: Boolean(cart),
    message: cart
      ? `${cart.lineCount} line${cart.lineCount === 1 ? "" : "s"} · ${(cart.totalCents / 100).toFixed(2)}`
      : "Item added; basket refresh required.",
    cart,
  };
}

export async function fastCompleteExactCash(input: {
  businessId: string;
  storeId: string;
  cartId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<FastPosResult> {
  if (
    !validScope(input) ||
    !input.cartId ||
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents < 0
  ) {
    return { ok: false, message: "Select an open basket.", cart: null };
  }
  const cart = await loadCart(input, input.cartId, false);
  if (!cart || cart.status !== "open" || cart.lineCount < 1) {
    return {
      ok: false,
      message: "An open basket with at least one line is required.",
      cart,
    };
  }
  if (cart.totalCents !== input.amountCents) {
    return {
      ok: false,
      message:
        "Basket total changed. Check the basket before retrying cash completion.",
      cart,
    };
  }
  const response = await keystoneClient<{
    completePosSale: {
      id: string;
      status: string;
      reference?: string | null;
    };
  }>(
    `
      mutation FastCompleteExactCash($input: CompletePosSaleInput!) {
        completePosSale(input: $input) { id status reference }
      }
    `,
    {
      input: {
        businessId: input.businessId,
        storeId: input.storeId,
        cartId: input.cartId,
        idempotencyKey: input.idempotencyKey,
        tenders: [
          {
            method: "cash",
            amountCents: input.amountCents,
            tenderedCents: input.amountCents,
          },
        ],
      },
    },
  );
  if (!response.success) {
    return {
      ok: false,
      message: response.error || "Sale could not be completed.",
      cart,
    };
  }
  return {
    ok: true,
    message: `${response.data.completePosSale.reference || "Sale"} completed.`,
    cart: null,
    saleId: response.data.completePosSale.id,
  };
}
