import bcrypt from "bcryptjs";
import type { Context } from ".keystone/types";

import { configureFuelTopology } from "../mutations/fuelControlOperations";
import { configureLoyaltyProgram } from "../mutations/loyaltyOperations";
import onboardConvenienceBusiness from "../mutations/onboardConvenienceBusiness";
import { keystoneContext } from "../context";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const passwordValue = process.env.RUNTIME_ADMIN_PASSWORD;
  const adminEmail = (
    process.env.RUNTIME_ADMIN_EMAIL || "convenience@openship.org"
  )
    .trim()
    .toLowerCase();
  if (!databaseUrl || !passwordValue)
    throw new Error(
      "Runtime seed requires DATABASE_URL and RUNTIME_ADMIN_PASSWORD",
    );
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "Runtime seed is disabled in production; use the owner-approved bootstrap and onboarding workflows",
    );
  if (passwordValue.length < 12)
    throw new Error(
      "Runtime admin password must contain at least 12 characters",
    );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
    throw new Error("Runtime admin email is invalid");
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  const disposableAllowed =
    process.env.ALLOW_DISPOSABLE_RUNTIME_SEED === "true" &&
    databaseName.startsWith("runtime_convenience_");
  if (databaseName !== "runtime_convenience" && !disposableAllowed) {
    throw new Error(
      "Runtime seed is restricted to runtime_convenience or an explicitly allowed disposable runtime_convenience_* database",
    );
  }

  const prisma = keystoneContext.prisma;
  const passwordHash = await bcrypt.hash(passwordValue, 12);
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: existingUser.name?.trim() || "Convenience Owner",
          password: passwordHash,
          isPlatformAdmin: true,
          platformAdminApprovedAt: new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          name: "Convenience Owner",
          email: adminEmail,
          password: passwordHash,
          isPlatformAdmin: true,
          platformAdminApprovedAt: new Date(),
          onboardingStatus: "not_started",
        },
      });

  const context = {
    ...keystoneContext,
    session: {
      itemId: user.id,
      listKey: "User",
      data: {
        name: user.name,
        email: user.email,
        isPlatformAdmin: true,
        platformAdminApprovedAt: user.platformAdminApprovedAt,
        employees: [],
      },
    },
  } as unknown as Context;

  const onboarding = await onboardConvenienceBusiness(
    null,
    {
      input: {
        businessName: "Openfront Convenience",
        businessCode: "openship-convenience",
        storeName: "Main Store",
        storeCode: "main",
        timezone: "America/New_York",
        currencyCode: "USD",
        standardTaxBasisPoints: 0,
        fuelEnabled: true,
        brandName: "Runtime Primary Business",
        brandTagline: "",
        brandMark: "R1",
        brandPrimaryColor: "#153F34",
        brandAccentColor: "#F4B942",
        storefrontStatus: "draft",
        idempotencyKey: "runtime-seed-onboarding-v4",
      },
    },
    context,
  );
  const alternateOnboarding = await onboardConvenienceBusiness(
    null,
    {
      input: {
        businessName: "Runtime Alternate Business",
        businessCode: "runtime-alternate",
        storeName: "Alternate Store",
        storeCode: "riverside",
        timezone: "America/Chicago",
        currencyCode: "USD",
        standardTaxBasisPoints: 0,
        fuelEnabled: false,
        brandName: "Runtime Alternate Business",
        brandTagline: "",
        brandMark: "R2",
        brandPrimaryColor: "#1F3A5F",
        brandAccentColor: "#EF8A70",
        storefrontStatus: "draft",
        idempotencyKey: "runtime-seed-alternate-onboarding-v3",
      },
    },
    context,
  );
  const employee = await prisma.employee.findFirst({
    where: { businessId: onboarding.id, userId: user.id, status: "active" },
    include: { stores: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const storeId = employee?.stores[0]?.id ?? onboarding.reference;
  if (!employee || !storeId)
    throw new Error("Runtime seed did not produce an owner/store assignment");

  await configureFuelTopology(
    null,
    {
      input: {
        businessId: onboarding.id,
        storeId,
        siteName: "Main Fuel Site",
        siteCode: "main-fuel",
        gradeName: "Regular",
        gradeCode: "regular",
        octaneRating: 87,
        tankNumber: "1",
        tankCapacityGallons: "10000.0000",
        initialVolumeGallons: "5000.0000",
        pumpNumber: "1",
        nozzleNumber: "1",
        idempotencyKey: "runtime-seed-fuel-topology-v1",
      },
    },
    context,
  );
  await configureLoyaltyProgram(
    null,
    {
      input: {
        businessId: onboarding.id,
        name: "Store Rewards",
        code: "store-rewards",
        status: "active",
        pointsPerDollar: 1,
        redemptionPoints: 100,
        redemptionValueCents: 100,
        pointsExpireAfterDays: null,
        idempotencyKey: "runtime-seed-loyalty-v1",
      },
    },
    context,
  );

  const counts = await Promise.all([
    prisma.business.count(),
    prisma.store.count({ where: { businessId: onboarding.id } }),
    prisma.productVariant.count({
      where: { businessId: onboarding.id, status: "active" },
    }),
    prisma.paymentProvider.count({
      where: { businessId: onboarding.id, status: "active" },
    }),
    prisma.fuelSite.count({
      where: { businessId: onboarding.id, enabled: true },
    }),
  ]);
  console.log(
    JSON.stringify(
      {
        database: databaseName,
        adminEmail,
        businessId: onboarding.id,
        storeId,
        alternateBusinessId: alternateOnboarding.id,
        draftStorefronts: [
          "Runtime Primary Business",
          "Runtime Alternate Business",
        ],
        counts: {
          businesses: counts[0],
          stores: counts[1],
          activeVariants: counts[2],
          activePaymentProviders: counts[3],
          enabledFuelSites: counts[4],
        },
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Runtime seed failed");
  process.exitCode = 1;
});
