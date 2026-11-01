/** A price as the shopper reads it: "$4.49", or "From $2.29" when sizes differ. */
export function Price({ cents, currency, from = false, className }: { cents: number; currency: string; from?: boolean; className?: string }) {
  const label = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  return (
    <span className={`sf-price ${className ?? ""}`}>
      {from ? <span className="sf-price__from">From </span> : null}
      {label}
    </span>
  );
}
