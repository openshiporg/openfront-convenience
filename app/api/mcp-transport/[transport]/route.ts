import {
  getNamedType,
  GraphQLSchema,
  type GraphQLOutputType,
  isEnumType,
  isListType,
  isNonNullType,
  isScalarType,
} from "graphql";

import { hasAssistantCapability } from "@/features/keystone/lib/assistant-capability";
import { keystoneContext } from "@/features/keystone/context";
import {
  RequestBodyError,
  readBoundedRequestJson,
} from "@/features/keystone/lib/bounded-request-body";
import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_FIELDS = 20;
const MAX_ROWS = 50;

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const tools: Tool[] = [
  {
    name: "listModels",
    description: "List the bounded read-only GraphQL collection operations available to the signed-in user.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "searchModels",
    description: "Find read-only collection operation names containing a short search term.",
    inputSchema: {
      type: "object",
      properties: { term: { type: "string", minLength: 1, maxLength: 80 } },
      required: ["term"],
      additionalProperties: false,
    },
  },
  {
    name: "getFieldsForType",
    description: "List scalar fields that can be safely selected for a GraphQL object type.",
    inputSchema: {
      type: "object",
      properties: { typeName: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{0,79}$" } },
      required: ["typeName"],
      additionalProperties: false,
    },
  },
  {
    name: "queryData",
    description: "Read at most 50 authorized rows from one GraphQL collection using scalar fields only.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{0,79}$" },
        fields: {
          type: "array",
          minItems: 1,
          maxItems: MAX_FIELDS,
          uniqueItems: true,
          items: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{0,79}$" },
        },
        limit: { type: "integer", minimum: 1, maximum: MAX_ROWS, default: 20 },
      },
      required: ["operation", "fields"],
      additionalProperties: false,
    },
  },
];

function response(id: unknown, result: unknown, status = 200): Response {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function rpcError(id: unknown, code: number, message: string, status = 400): Response {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function executeGraphQL(
  origin: string,
  cookie: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const graphqlResponse = await fetch(new URL("/api/graphql", origin), {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!graphqlResponse.ok) throw new Error("Authorized GraphQL request failed");
  const payload = await graphqlResponse.json() as { data?: unknown; errors?: unknown[] };
  if (payload.errors?.length) throw new Error("Authorized GraphQL request was denied");
  return payload.data;
}

function unwrapCollectionType(type: GraphQLOutputType) {
  let current: GraphQLOutputType = type;
  if (isNonNullType(current)) current = current.ofType;
  if (!isListType(current)) return null;
  current = current.ofType;
  if (isNonNullType(current)) current = current.ofType;
  return getNamedType(current);
}

function collectionOperations(schema: GraphQLSchema) {
  const fields = schema.getQueryType()?.getFields() ?? {};
  return Object.entries(fields)
    .flatMap(([name, field]) => {
      const itemType = unwrapCollectionType(field.type);
      const hasTake = field.args.some((argument) => argument.name === "take");
      return itemType && hasTake ? [{ operation: name, typeName: itemType.name }] : [];
    })
    .sort((left, right) => left.operation.localeCompare(right.operation));
}

function scalarFields(schema: GraphQLSchema, typeName: string): string[] {
  const type = schema.getType(typeName);
  if (!type || !("getFields" in type) || typeof type.getFields !== "function") return [];
  return Object.entries(type.getFields())
    .filter(([, field]) => {
      const named = getNamedType(field.type);
      return isScalarType(named) || isEnumType(named);
    })
    .map(([name]) => name)
    .sort();
}

function toolResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function callTool(
  schema: GraphQLSchema,
  origin: string,
  cookie: string,
  name: string,
  input: Record<string, unknown>,
) {
  const operations = collectionOperations(schema);
  if (name === "listModels") return toolResult(operations);
  if (name === "searchModels") {
    const term = typeof input.term === "string" ? input.term.trim().toLowerCase() : "";
    if (!term || term.length > 80) return toolResult({ error: "Search term is invalid" }, true);
    return toolResult(operations.filter((entry) =>
      entry.operation.toLowerCase().includes(term) || entry.typeName.toLowerCase().includes(term)).slice(0, 50));
  }
  if (name === "getFieldsForType") {
    const typeName = typeof input.typeName === "string" ? input.typeName : "";
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(typeName)) return toolResult({ error: "Type name is invalid" }, true);
    return toolResult({ typeName, fields: scalarFields(schema, typeName).slice(0, 100) });
  }
  if (name === "queryData") {
    const operation = typeof input.operation === "string" ? input.operation : "";
    const fields = Array.isArray(input.fields)
      ? input.fields.filter((field): field is string => typeof field === "string")
      : [];
    const limit = input.limit == null ? 20 : Number(input.limit);
    const collection = operations.find((entry) => entry.operation === operation);
    if (!collection || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ROWS) {
      return toolResult({ error: "Collection operation or limit is invalid" }, true);
    }
    const allowedFields = new Set(scalarFields(schema, collection.typeName));
    if (
      !fields.length ||
      fields.length > MAX_FIELDS ||
      new Set(fields).size !== fields.length ||
      fields.some((field) => !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(field) || !allowedFields.has(field))
    ) {
      return toolResult({ error: "Only bounded scalar fields from the selected type are allowed" }, true);
    }
    const query = `query McpBoundedRead($take: Int!) { ${operation}(take: $take) { ${fields.join(" ")} } }`;
    try {
      return toolResult(await executeGraphQL(origin, cookie, query, { take: limit }));
    } catch {
      return toolResult({ error: "The authorized read was denied" }, true);
    }
  }
  return toolResult({ error: "Unknown or non-read-only tool" }, true);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ transport: string }> },
) {
  let id: unknown = null;
  try {
    const { transport } = await params;
    if (transport !== "http") return rpcError(null, -32601, "Unsupported transport", 404);
    const body = await readBoundedRequestJson<JsonRpcRequest>(request, MAX_BODY_BYTES);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return rpcError(null, -32600, "Invalid JSON-RPC request");
    }
    id = body.id;
    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return rpcError(id, -32600, "Invalid JSON-RPC request");
    }
    const cookie = request.headers.get("cookie") ?? "";
    if (!await hasAssistantCapability(cookie)) return rpcError(id, -32001, "Forbidden", 403);

    if (body.method === "initialize") {
      return response(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "openfront-convenience-readonly", version: "1.0.0" },
      });
    }
    if (body.method === "notifications/initialized") return response(id, {});
    if (body.method === "tools/list") return response(id, { tools });
    if (body.method !== "tools/call") return rpcError(id, -32601, "Method not found");

    const paramsValue = body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? body.params as Record<string, unknown>
      : {};
    const name = typeof paramsValue.name === "string" ? paramsValue.name : "";
    const input = paramsValue.arguments && typeof paramsValue.arguments === "object" && !Array.isArray(paramsValue.arguments)
      ? paramsValue.arguments as Record<string, unknown>
      : {};
    const origin = await getBaseUrl();
    // Schema metadata is local and immutable for this build; data access still
    // executes through the authenticated GraphQL endpoint below.
    const schema = keystoneContext.graphql.schema;
    return response(id, await callTool(schema, origin, cookie, name, input));
  } catch (error) {
    if (error instanceof RequestBodyError) return rpcError(id, -32700, error.message, error.status);
    console.error("MCP request failed", { kind: error instanceof Error ? error.name : "unknown" });
    return rpcError(id, -32603, "Internal error", 500);
  }
}
