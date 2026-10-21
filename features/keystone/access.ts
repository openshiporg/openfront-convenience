export const permissionKeys = [
  "canAccessDashboard",
  "canUseAssistant",
  "canManageOnboarding",
  "canManageBusiness",
  "canManageRoles",
  "canReadPeople",
  "canManagePeople",
  "canReadCatalog",
  "canManageCatalog",
  "canReadPricing",
  "canManagePricing",
  "canReadInventory",
  "canManageInventory",
  "canReadPurchasing",
  "canManagePurchasing",
  "canReadSales",
  "canManageSales",
  "canReadPayments",
  "canManagePayments",
  "canReadCash",
  "canManageCash",
  "canReadPromotions",
  "canManagePromotions",
  "canReadLoyalty",
  "canManageLoyalty",
  "canReadCompliance",
  "canManageCompliance",
  "canReadPreparedFood",
  "canManagePreparedFood",
  "canReadFuel",
  "canManageFuel",
  "canReadLottery",
  "canManageLottery",
  "canReadMoneyServices",
  "canManageMoneyServices",
  "canReadReporting",
  "canManageReporting",
  "canReadExports",
  "canManageExports",
  "canReadAlerts",
  "canManageAlerts",
  "canReadOfflineOperations",
  "canManageOfflineOperations",
  "canReadIntegrations",
  "canManageIntegrations",
  "canManageApiKeys",
  "canReadAudit",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];
export type RoleSessionData = {
  id: string;
  name: string;
  business?: { id: string } | null;
  businessId?: string | null;
} & Partial<Record<PermissionKey, boolean>>;

export type EmployeeSessionData = {
  id: string;
  status: string;
  business?: { id: string; status?: string | null } | null;
  stores?: Array<{
    id: string;
    business?: { id: string } | null;
    businessId?: string | null;
  }> | null;
  role?: RoleSessionData | null;
};

export type Session = {
  itemId: string;
  listKey: string;
  apiKeyId?: string;
  apiKeyBusinessId?: string;
  apiKeyScopes?: string[];
  apiKeyStoreIds?: string[];
  apiKeyAllStores?: boolean;
  data: {
    name: string;
    email: string;
    isPlatformAdmin: boolean;
    platformAdminApprovedAt?: string | Date | null;
    sessionVersion?: number | null;
    employees?: EmployeeSessionData[] | null;
  };
};

type AccessArgs = { session?: Session };
type TenantMutationOptions = {
  create?: boolean;
  update?: boolean;
  delete?: boolean;
};

const managePermissionForRead = new Map<PermissionKey, PermissionKey>([
  ["canReadPeople", "canManagePeople"],
  ["canReadCatalog", "canManageCatalog"],
  ["canReadPricing", "canManagePricing"],
  ["canReadInventory", "canManageInventory"],
  ["canReadPurchasing", "canManagePurchasing"],
  ["canReadSales", "canManageSales"],
  ["canReadPayments", "canManagePayments"],
  ["canReadCash", "canManageCash"],
  ["canReadPromotions", "canManagePromotions"],
  ["canReadLoyalty", "canManageLoyalty"],
  ["canReadCompliance", "canManageCompliance"],
  ["canReadPreparedFood", "canManagePreparedFood"],
  ["canReadFuel", "canManageFuel"],
  ["canReadLottery", "canManageLottery"],
  ["canReadMoneyServices", "canManageMoneyServices"],
  ["canReadReporting", "canManageReporting"],
  ["canReadExports", "canManageExports"],
  ["canReadAlerts", "canManageAlerts"],
  ["canReadOfflineOperations", "canManageOfflineOperations"],
  ["canReadIntegrations", "canManageIntegrations"],
]);

function isActiveEmployee(employee: EmployeeSessionData): boolean {
  return (
    employee.status === "active" &&
    employee.business?.status === "active" &&
    Boolean(
      employee.business.id &&
      employee.role?.id &&
      (employee.role.business?.id ?? employee.role.businessId) ===
        employee.business.id,
    )
  );
}

function roleHasPermission(
  role: RoleSessionData | null | undefined,
  permission: PermissionKey,
): boolean {
  if (!role) return false;
  if (role[permission]) return true;
  const impliedBy = managePermissionForRead.get(permission);
  return impliedBy ? Boolean(role[impliedBy]) : false;
}

export function isSignedIn({ session }: AccessArgs): boolean {
  return Boolean(session);
}

export function isMachineSession(session: Session | undefined): boolean {
  return Boolean(session?.apiKeyId && session.apiKeyBusinessId);
}

export function isHumanPlatformAdmin(session: Session | undefined): boolean {
  return Boolean(
    session &&
    !isMachineSession(session) &&
    session.data?.isPlatformAdmin &&
    session.data.platformAdminApprovedAt,
  );
}

export function hasUnrestrictedStoreAccess(
  session: Session | undefined,
): boolean {
  return (
    isHumanPlatformAdmin(session) ||
    Boolean(isMachineSession(session) && session?.apiKeyAllStores)
  );
}

function machineHasPermission(
  session: Session | undefined,
  permission: PermissionKey,
): boolean {
  return Boolean(
    isMachineSession(session) && session?.apiKeyScopes?.includes(permission),
  );
}

export function isPlatformAdmin({ session }: AccessArgs): boolean {
  return isHumanPlatformAdmin(session);
}

export function hasPermission(
  { session }: AccessArgs,
  permission: PermissionKey,
): boolean {
  if (isMachineSession(session))
    return machineHasPermission(session, permission);
  if (isHumanPlatformAdmin(session)) return true;
  return Boolean(
    session?.data?.employees?.some(
      (employee) =>
        isActiveEmployee(employee) &&
        roleHasPermission(employee.role, permission),
    ),
  );
}

export function businessIdsForPermission(
  session: Session | undefined,
  permission: PermissionKey,
): string[] {
  if (!session) return [];
  if (isMachineSession(session)) {
    return machineHasPermission(session, permission) && session.apiKeyBusinessId
      ? [session.apiKeyBusinessId]
      : [];
  }
  if (isHumanPlatformAdmin(session)) return [];

  return Array.from(
    new Set(
      (session.data.employees ?? [])
        .filter(
          (employee) =>
            isActiveEmployee(employee) &&
            roleHasPermission(employee.role, permission),
        )
        .map((employee) => employee.business?.id)
        .filter((businessId): businessId is string => Boolean(businessId)),
    ),
  ).sort();
}

export function storeIdsForPermission(
  session: Session | undefined,
  permission: PermissionKey,
  businessId?: string,
): string[] {
  if (!session) return [];
  if (isMachineSession(session)) {
    if (!machineHasPermission(session, permission) || session.apiKeyAllStores)
      return [];
    return Array.from(new Set(session.apiKeyStoreIds ?? [])).sort();
  }
  if (isHumanPlatformAdmin(session)) return [];
  return Array.from(
    new Set(
      (session.data.employees ?? [])
        .filter(
          (employee) =>
            isActiveEmployee(employee) &&
            roleHasPermission(employee.role, permission) &&
            (!businessId || employee.business?.id === businessId),
        )
        .flatMap((employee) => employee.stores ?? [])
        .filter(
          (store) =>
            !businessId ||
            (store.business?.id ?? store.businessId) === businessId,
        )
        .map((store) => store.id)
        .filter(Boolean),
    ),
  ).sort();
}

export function canAccessStore(
  session: Session | undefined,
  businessId: string,
  storeId: string,
  permission: PermissionKey,
): boolean {
  if (!canAccessBusiness(session, businessId, permission)) return false;
  if (isMachineSession(session)) {
    return Boolean(
      session?.apiKeyAllStores || session?.apiKeyStoreIds?.includes(storeId),
    );
  }
  if (isHumanPlatformAdmin(session)) return true;
  return storeIdsForPermission(session, permission, businessId).includes(
    storeId,
  );
}

export function allBusinessIds(session: Session | undefined): string[] {
  if (!session) return [];
  if (isMachineSession(session)) {
    return session.apiKeyBusinessId ? [session.apiKeyBusinessId] : [];
  }
  if (isHumanPlatformAdmin(session)) return [];
  return Array.from(
    new Set(
      (session.data.employees ?? [])
        .filter(isActiveEmployee)
        .map((employee) => employee.business?.id)
        .filter((businessId): businessId is string => Boolean(businessId)),
    ),
  ).sort();
}

export function canAccessBusiness(
  session: Session | undefined,
  businessId: string,
  permission: PermissionKey,
): boolean {
  if (isMachineSession(session)) {
    return (
      session?.apiKeyBusinessId === businessId &&
      machineHasPermission(session, permission)
    );
  }
  if (isHumanPlatformAdmin(session)) return true;
  return businessIdsForPermission(session, permission).includes(businessId);
}

export function employeeForBusiness(
  session: Session | undefined,
  businessId: string,
  permission: PermissionKey,
  storeId?: string | null,
): EmployeeSessionData | null {
  if (!session || isMachineSession(session)) return null;
  return (
    session.data.employees?.find(
      (employee) =>
        isActiveEmployee(employee) &&
        employee.business?.id === businessId &&
        roleHasPermission(employee.role, permission) &&
        (!storeId || employee.stores?.some((store) => store.id === storeId)),
    ) ?? null
  );
}

export function tenantFilterFor(
  session: Session | undefined,
  requestedPermissions: PermissionKey[],
): true | false | { business: { id: { in: string[] } } } {
  if (!session) return false;
  if (isMachineSession(session)) {
    const ids =
      requestedPermissions.some((permission) =>
        machineHasPermission(session, permission),
      ) && session.apiKeyBusinessId
        ? [session.apiKeyBusinessId]
        : [];
    return ids.length ? { business: { id: { in: ids } } } : false;
  }
  if (isHumanPlatformAdmin(session)) return true;

  const ids = Array.from(
    new Set(
      requestedPermissions.flatMap((permission) =>
        businessIdsForPermission(session, permission),
      ),
    ),
  ).sort();

  return ids.length ? { business: { id: { in: ids } } } : false;
}

const multiStoreListKeys = new Set([
  "CompliancePolicy",
  "ExportDestination",
  "MoneyServiceProvider",
  "PriceBook",
  "Promotion",
]);

const parentStoreListKeys = new Set([
  "InventoryTransferLine",
  "InventoryTransferLotAllocation",
  "PriceBookEntry",
  "PromotionRule",
]);

const directStoreListKeys = new Set([
  "AgeVerification",
  "AlertEvaluation",
  "ApiKey",
  "AuditEvent",
  "BankDeposit",
  "Cart",
  "CartLine",
  "CashMovement",
  "ComplianceIncident",
  "ExportBatch",
  "ExportLine",
  "FuelDelivery",
  "FuelGrade",
  "FuelNozzle",
  "FuelPrice",
  "FuelPump",
  "FuelReconciliation",
  "FuelSite",
  "FuelTank",
  "FuelTankReading",
  "FuelTransaction",
  "InventoryCount",
  "InventoryCountLine",
  "InventoryLedgerEntry",
  "InventoryLocation",
  "InventoryLot",
  "LotteryPack",
  "LotteryPackEvent",
  "LotterySettlement",
  "LoyaltyLedgerEntry",
  "MoneyServiceSettlement",
  "MoneyServiceTransaction",
  "OfflineDevice",
  "OfflineOperation",
  "OfflineOperationBatch",
  "OperationalAlert",
  "OutboxAttempt",
  "OutboxEvent",
  "PaymentReconciliation",
  "PaymentReconciliationLine",
  "PrepBatch",
  "PromotionRedemption",
  "PurchaseOrder",
  "PurchaseOrderLine",
  "Receiving",
  "ReceivingLine",
  "Refund",
  "RefundLine",
  "RefundTenderAllocation",
  "Register",
  "RegisterSession",
  "Return",
  "ReturnLine",
  "Sale",
  "SaleLine",
  "Shift",
  "StockLevel",
  "StoreDay",
  "StoreDayLine",
  "TaxRate",
  "Tender",
  "WasteEvent",
]);

function tenantFilterForList(
  session: Session | undefined,
  requestedPermissions: PermissionKey[],
  listKey?: string,
): true | false | Record<string, unknown> {
  const base = tenantFilterFor(session, requestedPermissions);
  if (base === true || base === false || !listKey) return base;
  if (
    !directStoreListKeys.has(listKey) &&
    !multiStoreListKeys.has(listKey) &&
    !parentStoreListKeys.has(listKey) &&
    listKey !== "Store" &&
    listKey !== "InventoryTransfer"
  )
    return base;
  if (isMachineSession(session) && session?.apiKeyAllStores) return base;
  const storeIds = Array.from(
    new Set(
      requestedPermissions.flatMap((permission) =>
        storeIdsForPermission(session, permission),
      ),
    ),
  ).sort();
  if (!storeIds.length) return false;
  if (listKey === "ApiKey") {
    return {
      AND: [
        base,
        { allStores: { equals: false } },
        { stores: { some: { id: { in: storeIds } } } },
        { stores: { none: { id: { notIn: storeIds } } } },
      ],
    };
  }
  if (listKey === "Store") return { AND: [base, { id: { in: storeIds } }] };
  const applicableStoreFilter = {
    OR: [
      { stores: { none: {} } },
      { stores: { some: { id: { in: storeIds } } } },
    ],
  };
  if (multiStoreListKeys.has(listKey)) {
    return { AND: [base, applicableStoreFilter] };
  }
  if (listKey === "PriceBookEntry") {
    return { AND: [base, { priceBook: applicableStoreFilter }] };
  }
  if (listKey === "PromotionRule") {
    return { AND: [base, { promotion: applicableStoreFilter }] };
  }
  const transferStoreFilter = {
    OR: [
      { sourceStore: { id: { in: storeIds } } },
      { destinationStore: { id: { in: storeIds } } },
    ],
  };
  if (listKey === "InventoryTransferLine") {
    return { AND: [base, { transfer: transferStoreFilter }] };
  }
  if (listKey === "InventoryTransferLotAllocation") {
    return {
      AND: [base, { line: { transfer: transferStoreFilter } }],
    };
  }
  if (listKey === "InventoryTransfer") {
    return {
      AND: [base, transferStoreFilter],
    };
  }
  return { AND: [base, { store: { id: { in: storeIds } } }] };
}

function inputBusinessId(
  inputData: Record<string, any> | undefined,
): string | null {
  return inputData?.business?.connect?.id ?? null;
}

function canTargetInputBusiness(
  session: Session | undefined,
  inputData: Record<string, any> | undefined,
  permission: PermissionKey,
): boolean {
  if (isMachineSession(session)) {
    const businessId = inputBusinessId(inputData);
    return Boolean(
      businessId &&
      businessId === session?.apiKeyBusinessId &&
      machineHasPermission(session, permission),
    );
  }
  if (isHumanPlatformAdmin(session)) return true;
  const businessId = inputBusinessId(inputData);
  return Boolean(
    businessId && canAccessBusiness(session, businessId, permission),
  );
}

function inputStoreIds(inputData: Record<string, any> | undefined): string[] {
  const ids = [
    inputData?.store?.connect?.id,
    inputData?.sourceStore?.connect?.id,
    inputData?.destinationStore?.connect?.id,
    ...((inputData?.stores?.connect ?? []) as Array<{ id?: string }>).map(
      (entry) => entry.id,
    ),
    ...((inputData?.stores?.set ?? []) as Array<{ id?: string }>).map(
      (entry) => entry.id,
    ),
  ];
  return Array.from(
    new Set(
      ids.filter((id): id is string => typeof id === "string" && Boolean(id)),
    ),
  );
}

function canTargetInputStores(
  session: Session | undefined,
  inputData: Record<string, any> | undefined,
  permission: PermissionKey,
): boolean {
  const businessId = inputBusinessId(inputData);
  const storeIds = inputStoreIds(inputData);
  return (
    !storeIds.length ||
    Boolean(
      businessId &&
      storeIds.every((storeId) =>
        canAccessStore(session, businessId, storeId, permission),
      ),
    )
  );
}

export function tenantAccess(
  readPermission: PermissionKey,
  managePermission: PermissionKey,
  options: TenantMutationOptions = {},
) {
  const { create = true, update = true, delete: canDelete = false } = options;
  const canRead = ({ session }: AccessArgs) =>
    hasPermission({ session }, readPermission) ||
    hasPermission({ session }, managePermission);
  const canManage = ({ session }: AccessArgs) =>
    hasPermission({ session }, managePermission);

  return {
    operation: {
      query: canRead,
      create: (args: AccessArgs) => create && canManage(args),
      update: (args: AccessArgs) => update && canManage(args),
      delete: (args: AccessArgs) => canDelete && canManage(args),
    },
    filter: {
      query: ({ session, listKey }: AccessArgs & { listKey?: string }) =>
        tenantFilterForList(
          session,
          [readPermission, managePermission],
          listKey,
        ),
      update: ({ session, listKey }: AccessArgs & { listKey?: string }) =>
        tenantFilterForList(session, [managePermission], listKey),
      delete: ({ session, listKey }: AccessArgs & { listKey?: string }) =>
        tenantFilterForList(session, [managePermission], listKey),
    },
    item: {
      create: ({
        session,
        inputData,
      }: AccessArgs & { inputData?: Record<string, any> }) =>
        create &&
        canTargetInputBusiness(session, inputData, managePermission) &&
        canTargetInputStores(session, inputData, managePermission),
      update: ({
        session,
        inputData,
      }: AccessArgs & { inputData?: Record<string, any> }) =>
        update &&
        (!inputData?.business ||
          canTargetInputBusiness(session, inputData, managePermission)) &&
        canTargetInputStores(session, inputData, managePermission),
      delete: ({ session }: AccessArgs) => canDelete && canManage({ session }),
    },
  };
}

export function immutableTenantAccess(readPermission: PermissionKey) {
  return {
    operation: {
      query: ({ session }: AccessArgs) =>
        hasPermission({ session }, readPermission),
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: ({ session, listKey }: AccessArgs & { listKey?: string }) =>
        tenantFilterForList(session, [readPermission], listKey),
    },
  };
}

export const permissions = Object.fromEntries(
  permissionKeys.map((permission) => [
    permission,
    ({ session }: AccessArgs) => hasPermission({ session }, permission),
  ]),
) as Record<PermissionKey, (args: AccessArgs) => boolean>;

export function assertBusinessPermission(
  session: Session | undefined,
  businessId: string,
  permission: PermissionKey,
): void {
  if (!canAccessBusiness(session, businessId, permission)) {
    throw new Error("Access denied for this business");
  }
}

export function assertStorePermission(
  session: Session | undefined,
  businessId: string,
  storeId: string,
  permission: PermissionKey,
): void {
  if (!canAccessStore(session, businessId, storeId, permission)) {
    throw new Error("Access denied for this store");
  }
}
