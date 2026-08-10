"use client";
import { useState } from "react";
import RecipeForm from "@/components/recipe/RecipeForm";
import { saveNewRecipe } from "../actions";
import type { RecipeDraft } from "@/types";

export default function NewRecipePage() {
  const [tab, setTab] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<RecipeDraft | null>(null);

  async function importUrl(e: React.FormEvent) {
    e.preventDefault();
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setPrefill(json.draft);
      setTab("manual");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Add a recipe</h1>

      <div className="mb-6 flex gap-1 rounded-xl border border-neutral-200 p-1">
        {(["url", "manual"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm ${tab === t ? "bg-neutral-900 text-white" : ""}`}>
            {t === "url" ? "Paste URL" : "Manual"}
          </button>
        ))}
      </div>

      {tab === "url" && !prefill && (
        <form onSubmit={importUrl} className="space-y-3">
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required
            placeholder="https://example.com/best-pasta"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={importing}
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {importing ? "Reading page…" : "Import recipe"}
          </button>
          <p className="text-xs text-neutral-500">We&apos;ll pull in what we can — you can fix anything before saving.</p>
        </form>
      )}

      {tab === "manual" && (
        <RecipeForm initial={prefill ?? undefined} onSubmit={saveNewRecipe} submitLabel="Save recipe" />
      )}
    </div>
  );
}
