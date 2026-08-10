"use client";

export default function ServingScaler({
  base, value, onChange,
}: { base: number; value: number; onChange: (n: number) => void }) {
  const presets = [0.5, 1, 2];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">Servings</span>
      <div className="flex items-center gap-1 rounded-xl border border-neutral-200 p-1">
        {presets.map((p) => {
          const target = Math.max(1, Math.round(base * p));
          const active = value === target;
          return (
            <button key={p} onClick={() => onChange(target)}
              className={`rounded-lg px-2.5 py-1 text-sm ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}>
              {p === 0.5 ? "½×" : `${p}×`}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, value - 1))}
          className="h-8 w-8 rounded-lg border border-neutral-200">–</button>
        <span className="w-8 text-center text-sm font-medium">{value}</span>
        <button onClick={() => onChange(value + 1)}
          className="h-8 w-8 rounded-lg border border-neutral-200">+</button>
      </div>
    </div>
  );
}
