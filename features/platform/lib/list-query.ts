import { getListByPath } from "@/features/dashboard/actions/getListByPath";
import { buildOrderByClause } from "@/features/dashboard/lib/buildOrderByClause";
import { buildWhereClause } from "@/features/dashboard/lib/buildWhereClause";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

type SearchRecord = Record<string, string | string[] | undefined>;

export type StatusTab = { value: string; label: string };

export type PlatformListResult<T> = {
  list: any;
  items: T[];
  count: number;
  page: number;
  pageSize: number;
  status: string;
  statusCounts: Record<string, number>;
  error: string | null;
};

/**
 * The dashboard list pattern used by E-commerce's platform pages: search,
 * filters and sort come from the URL through the dashboard's own builders, and
 * the page adds its scope and status tab before querying with a custom selection.
 */
export async function loadPlatformList<T>({
  path,
  search,
  scopeWhere,
  selection,
  statusField = "status",
  statuses = [],
  pageSize: defaultPageSize = 25,
}: {
  path: string;
  search: SearchRecord;
  scopeWhere: Record<string, unknown>;
  selection: string;
  statusField?: string;
  statuses?: StatusTab[];
  pageSize?: number;
}): Promise<PlatformListResult<T>> {
  const list = await getListByPath(path);
  const flat = Object.fromEntries(
    Object.entries(search).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const page = Math.max(1, Number.parseInt(flat.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(flat.pageSize ?? "", 10) || defaultPageSize));
  const status = statuses.some((entry) => entry.value === flat.status) ? (flat.status as string) : "all";
  if (!list) {
    return { list: null, items: [], count: 0, page, pageSize, status, statusCounts: {}, error: "List unavailable" };
  }
  const conditions: Record<string, unknown>[] = [scopeWhere];
  const filters = buildWhereClause(list, flat);
  if (Object.keys(filters).length) conditions.push(filters);
  if (flat.search) {
    const searchWhere = buildWhereClause(list, { search: flat.search });
    if (Object.keys(searchWhere).length) conditions.push(searchWhere);
  }
  const statusWhere = (value: string) => ({ [statusField]: { equals: value } });
  const where = { AND: status === "all" ? conditions : [...conditions, statusWhere(status)] };
  const names = list.graphql?.names ?? {};
  const listQuery = names.listQueryName;
  const countQuery = names.listQueryCountName;
  const whereType = names.whereInputName;
  const orderType = names.listOrderName;
  const tabCounts = statuses
    .map((entry) => `${entry.value.replace(/\W/g, "_")}: ${countQuery}(where: { AND: [$base, { ${statusField}: { equals: ${entry.value} } }] })`)
    .join("\n");
  const response = await keystoneClient<{ items: T[]; count: number } & Record<string, number>>(
    `query PlatformList($where: ${whereType}!, $base: ${whereType}!, $take: Int!, $skip: Int!, $orderBy: [${orderType}!]) {
      items: ${listQuery}(where: $where, take: $take, skip: $skip, orderBy: $orderBy) { ${selection} }
      count: ${countQuery}(where: $where)
      all: ${countQuery}(where: $base)
      ${tabCounts}
    }`,
    {
      where,
      base: { AND: conditions },
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: buildOrderByClause(list, flat),
    },
  );
  if (!response.success) {
    return { list, items: [], count: 0, page, pageSize, status, statusCounts: {}, error: response.error };
  }
  const statusCounts: Record<string, number> = { all: response.data.all ?? 0 };
  for (const entry of statuses) statusCounts[entry.value] = response.data[entry.value.replace(/\W/g, "_")] ?? 0;
  return {
    list,
    items: response.data.items ?? [],
    count: response.data.count ?? 0,
    page,
    pageSize,
    status,
    statusCounts,
    error: null,
  };
}
