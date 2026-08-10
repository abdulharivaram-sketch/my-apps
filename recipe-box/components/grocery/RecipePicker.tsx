"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/types";
import { makeListFromRecipes } from "@/app/(app)/grocery/actions";

export default function RecipePicker({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  async function generate() {
    setBusy(true);
    const list = await makeListFromRecipes([...selected]);
    router.push(`/grocery/${list.id}`);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {recipes.map((r) => (
          <button key={r.id} onClick={() => toggle(r.id)}
            className={`rounded-xl border p-2 text-left text-sm ${selected.has(r.id) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`}>
            {r.title}
          </button>
        ))}
      </div>
      <button onClick={generate} disabled={!selected.size || busy}
        className="mt-4 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40">
        {busy ? "Building…" : `Generate list (${selected.size})`}
      </button>
    </div>
  );
}
