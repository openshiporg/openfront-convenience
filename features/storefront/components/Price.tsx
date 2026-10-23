/** Shelf-tag price: currency mark and cents raised beside large units. */
export function Price({ cents, currency, from = false, className }: { cents: number; currency: string; from?: boolean; className?: string }) {
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(cents / 100);
  const symbol = parts.filter((part) => part.type === "currency").map((part) => part.value).join("");
  const units = parts.filter((part) => ["integer", "group", "minusSign"].includes(part.type)).map((part) => part.value).join("");
  const fraction = parts.find((part) => part.type === "fraction")?.value;
  const label = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  return (
    <span className={`sf-price ${className ?? ""}`} aria-label={from ? `From ${label}` : label}>
      {from ? <span className="sf-price__from" aria-hidden="true">From</span> : null}
      <span className="sf-price__sym" aria-hidden="true">{symbol}</span>
      <span className="sf-price__units" aria-hidden="true">{units}</span>
      {fraction ? <span className="sf-price__cents" aria-hidden="true">{fraction}</span> : null}
    </span>
  );
}
