"use client";

// E-commerce's platform filter bar (search, filters, sort, active filters),
// with its controls as raised pills in a recessed track.

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";

import { FilterAdd } from "../../dashboard/components/FilterAdd";
import { FilterList } from "../../dashboard/components/FilterList";
import { SortSelection } from "../../dashboard/components/SortSelection";
import { enhanceFields } from "../../dashboard/utils/enhanceFields";
import { inputClass, pillClass, trackClass } from "./cv-ui";

export function PlatformFilterBar({ list, actions }: { list: any; actions?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams?.get("search") || "";

  const enhancedFields = useMemo(() => enhanceFields(list.fields, list.key), [list.fields, list.key]);

  const updateSearch = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value.trim()) params.set("search", value.trim());
    else params.delete("search");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const searchLabels = Object.values(enhancedFields)
    .filter((field: any) => field.controller?.filter && Object.keys(field.controller.filter.types || {}).length > 0)
    .map((field: any) => String(field.label).toLowerCase());

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <form
          role="search"
          className="relative min-w-56 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            updateSearch(String(new FormData(event.currentTarget).get("search") ?? ""));
          }}
        >
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor={`search-${list.key}`}>
            Search
          </label>
          <input
            id={`search-${list.key}`}
            // Keyed by the URL value so back/forward and cleared filters reset it.
            key={currentSearch}
            type="search"
            name="search"
            defaultValue={currentSearch}
            placeholder={`Search ${searchLabels.slice(0, 3).join(", ") || "records"}`}
            className={`${inputClass} pl-9`}
          />
        </form>
        <div className={trackClass}>
          <FilterAdd list={list}>
            <button type="button" className={pillClass}>
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              Filter
            </button>
          </FilterAdd>
          <SortSelection listMeta={list}>
            <button type="button" className={pillClass}>
              <ArrowUpDown aria-hidden="true" className="size-3.5" />
              Sort
            </button>
          </SortSelection>
        </div>
        {actions}
      </div>
      <FilterList list={list} />
    </div>
  );
}
