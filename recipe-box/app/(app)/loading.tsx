export default function Loading() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="aspect-[4/3] w-full bg-neutral-100" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-3/4 rounded bg-neutral-100" />
            <div className="h-3 w-1/2 rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
