import Link from "next/link";
import type { ReactNode } from "react";

export type Aisle = { name: string; number: number };

export const aisleHref = (name: string, query = "") => {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("category", name);
  return `/shop?${params}`;
};

/** The store's categories in order: aisle numbers follow this list on every page. */
export const numberAisles = (names: string[]): Aisle[] => names.map((name, index) => ({ name, number: index + 1 }));

/** Hanging aisle signs; the row scrolls sideways on a phone. */
export function AisleSigns({ aisles, current, allHref, hrefFor }: { aisles: Aisle[]; current?: string | null; allHref: string; hrefFor: (name: string) => string }) {
  return (
    <nav className="sf-signs" aria-label="Aisles">
      <ol className="sf-signs__row">
        {aisles.map((aisle) => (
          <li key={aisle.name}>
            <Link href={hrefFor(aisle.name)} className="sf-sign" aria-current={current === aisle.name ? "page" : undefined}>
              <span className="sf-sign__no">
                <span className="sf-sr">Aisle </span>
                {aisle.number}
              </span>
              <span className="sf-sign__name">{aisle.name}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href={allHref} className="sf-sign" data-kind="all" aria-current={current === null ? "page" : undefined}>
            <span className="sf-sign__name">All aisles</span>
          </Link>
        </li>
      </ol>
    </nav>
  );
}

/** Section header for one aisle's shelf. */
export function AisleHead({ aisle, name, id, children }: { aisle: Aisle | null; name: string; id: string; children?: ReactNode }) {
  return (
    <div className="sf-aislehead">
      <h2 id={id} className="sf-plate">
        {aisle ? (
          <span className="sf-plate__no">
            <span className="sf-sr">Aisle </span>
            {aisle.number}
          </span>
        ) : null}
        <span className="sf-plate__name">{name}</span>
      </h2>
      {children}
    </div>
  );
}
