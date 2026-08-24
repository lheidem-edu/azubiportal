/**
 * Hüllt breite Tabellen ein, damit sie auf dem Telefon seitlich scrollen,
 * statt das ganze Layout auseinanderzuziehen.
 */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <div className="min-w-[36rem]">{children}</div>
    </div>
  );
}
