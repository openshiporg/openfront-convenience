import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import { statelessSessions } from "@keystone-6/core/session";
import bcrypt from "bcryptjs";
import "dotenv/config";

import {
  hasPermission,
  isHumanPlatformAdmin,
  permissionKeys,
  type Session,
} from "./access";
import { parseMachineApiToken } from "./lib/machineAuth";
import { sendPasswordResetEmail } from "./lib/mail";
import { models } from "./models";
import { extendGraphqlSchema } from "./mutations";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
const sessionSecret = requiredEnv("SESSION_SECRET");
if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long");
}

export const basePath = "/dashboard";

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 30,
  secret: sessionSecret,
};

const browserSessions = statelessSessions(sessionConfig);
const sessionStrategy = {
  ...browserSessions,
  async start(args: Parameters<typeof browserSessions.start>[0]) {
    const data = args.data as {
      itemId?: string;
      listKey?: string;
      sessionVersion?: number;
    };
    if (data.itemId && data.listKey === "User") {
      const user = await args.context.prisma.user.findUnique({
        where: { id: data.itemId },
        select: { sessionVersion: true },
      });
      if (!user) return undefined;
      return browserSessions.start({
        ...args,
        data: { ...data, sessionVersion: user.sessionVersion },
      });
    }
    return browserSessions.start(args);
  },
  async get(args: Parameters<typeof browserSessions.get>[0]) {
    const authorization = args.context.req?.headers.authorization;
    const header = Array.isArray(authorization)
      ? authorization[0]
      : authorization;
    if (!header?.startsWith("Bearer ")) {
      const session = (await browserSessions.get(args)) as
        | {
            itemId?: string;
            listKey?: string;
            sessionVersion?: number | null;
          }
        | undefined;
      if (!session?.itemId || session.listKey !== "User") return undefined;
      const user = await args.context.prisma.user.findUnique({
        where: { id: session.itemId },
        select: { sessionVersion: true },
      });
      if (
        !user ||
        !Number.isSafeInteger(session.sessionVersion) ||
        session.sessionVersion !== user.sessionVersion
      )
        return undefined;
      // createAuth's outer session wrapper hydrates current User, Employee,
      // Role, and Store data after this version check on every request.
      return session;
    }

    const token = header.slice("Bearer ".length).trim();
    const parsed = parseMachineApiToken(token);
    if (!parsed) return undefined;
    const key = await args.context.prisma.apiKey.findUnique({
      where: { keyPrefix: parsed.keyPrefix },
      select: {
        id: true,
        businessId: true,
        business: { select: { status: true } },
        createdById: true,
        secretHash: true,
        scopes: true,
        allStores: true,
        stores: { select: { id: true } },
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        failedAuthCount: true,
        failedAuthResetAt: true,
      },
    });
    const now = new Date();
    const valid = Boolean(
      key?.createdById &&
      key.business?.status === "active" &&
      key.status === "active" &&
      (!key.expiresAt || key.expiresAt > now) &&
      (await bcrypt.compare(token, key.secretHash)),
    );
    if (key) {
      const activeFailureWindow = Boolean(
        key.failedAuthResetAt && key.failedAuthResetAt > now,
      );
      if (
        valid &&
        (key.failedAuthCount > 0 ||
          key.failedAuthResetAt ||
          !key.lastUsedAt ||
          key.lastUsedAt.getTime() < now.getTime() - 60_000)
      ) {
        await args.context.prisma.apiKey.update({
          where: { id: key.id },
          data: {
            lastUsedAt: now,
            failedAuthCount: 0,
            failedAuthResetAt: null,
          },
        });
      } else if (!activeFailureWindow) {
        // At most one evidence write per public prefix/window. Invalid suffixes
        // never disable the credential and cannot amplify database writes.
        await args.context.prisma.apiKey.update({
          where: { id: key.id },
          data: {
            failedAuthCount: Math.min(1_000_000, key.failedAuthCount + 1),
            failedAuthResetAt: new Date(now.getTime() + 5 * 60 * 1000),
          },
        });
      }
    }
    if (!valid || !key?.createdById) return undefined;
    const validPermissions = new Set<string>(permissionKeys);
    const scopes = Array.isArray(key.scopes)
      ? key.scopes.filter(
          (scope: unknown): scope is string =>
            typeof scope === "string" && validPermissions.has(scope),
        )
      : [];
    return {
      itemId: key.createdById,
      listKey: "User",
      apiKeyId: key.id,
      apiKeyBusinessId: key.businessId,
      apiKeyScopes: scopes,
      apiKeyStoreIds: key.stores.map((store: { id: string }) => store.id),
      apiKeyAllStores: key.allStores,
    };
  },
};

const rolePermissionSelection = permissionKeys.join("\n");

function addConvenienceDatabaseConstraints(schema: string): string {
  const appendDirectives = (modelName: string, directives: string[]) => {
    const pattern = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`);
    const model = schema.match(pattern)?.[0];
    if (!model)
      throw new Error(`Generated Prisma schema is missing ${modelName}`);
    const missing = directives.filter(
      (directive) => !model.includes(directive),
    );
    if (!missing.length) return;
    schema = schema.replace(
      model,
      model.replace(
        /\n\}$/,
        `\n${missing.map((directive) => `  ${directive}`).join("\n")}\n}`,
      ),
    );
  };
  appendDirectives("Employee", [
    '@@unique([businessId, userId], map: "Employee_business_user_key")',
  ]);
  appendDirectives("FuelTransaction", [
    '@@unique([siteId, controllerTransactionId], map: "FuelTransaction_site_controller_key")',
    '@@unique([tenderId], map: "FuelTransaction_tender_key")',
  ]);
  return schema;
}

const genericIdentityAndTenantConfiguration = new Set([
  "Business",
  "Store",
  "User",
  "Employee",
  "Role",
]);
const boundedModels = Object.fromEntries(
  Object.entries(models).map(([key, model]) => {
    const workflowOnly = !genericIdentityAndTenantConfiguration.has(key);
    const existingOmit =
      typeof model.graphql?.omit === "object" ? model.graphql.omit : {};
    return [
      key,
      {
        ...model,
        // Match the generic UI to the same workflow-only mutation boundary.
        // Per-field hidden/read modes remain intact; domain commands own edits.
        ui: {
          ...model.ui,
          ...(workflowOnly ? { itemView: { ...model.ui?.itemView, defaultFieldMode: "read" as const } } : {}),
        },
        graphql: {
          ...model.graphql,
          omit: {
            ...existingOmit,
            delete: true,
            ...(workflowOnly ? { create: true, update: true } : {}),
          },
        },
      },
    ];
  }),
) as typeof models;

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      // The first user administers the platform and runs onboarding, as the
      // first user does in E-commerce.
      isPlatformAdmin: true,
      platformAdminApprovedAt: new Date(),
      onboardingStatus: "not_started",
    },
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    },
  },
  sessionData: `
    name
    email
    isPlatformAdmin
    platformAdminApprovedAt
    sessionVersion
    employees {
      id
      status
      business { id status }
      stores { id business { id status } }
      role {
        id
        name
        business { id }
        ${rolePermissionSelection}
      }
    }
  `,
});

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: databaseURL,
      extendPrismaSchema: addConvenienceDatabaseConstraints,
    },
    lists: boundedModels,
    ui: {
      isAccessAllowed: ({ session }) =>
        Boolean(
          !(session as { apiKeyId?: string } | undefined)?.apiKeyId &&
          (isHumanPlatformAdmin(session as Session | undefined) ||
            hasPermission(
              { session: session as Session | undefined },
              "canAccessDashboard",
            )),
        ),
      basePath,
    },
    session: sessionStrategy,
    graphql: {
      extendGraphqlSchema,
    },
  }),
);
