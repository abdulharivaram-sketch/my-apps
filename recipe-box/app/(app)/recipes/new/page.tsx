"use client";
import { useState } from "react";
import RecipeForm from "@/components/recipe/RecipeForm";
import { saveNewRecipe } from "../actions";
import { parseCaptionRecipe } from "@/lib/import/parse-recipe";
import type { RecipeDraft } from "@/types";

type Tab = "url" | "text" | "manual";

const emptyDraft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
  title: "", description: null, image_url: null, source_url: null,
  servings: 2, prep_minutes: null, cook_minutes: null,
  ingredients: [], steps: [], tags: [], ...over,
});

export default function NewRecipePage() {
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
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
      if (!json.draft?.ingredients?.length) {
        setError("Couldn't read ingredients from that link (common for Instagram/TikTok). Try the \"Paste text\" tab instead.");
      } else {
        setTab("manual");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function parseText(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseCaptionRecipe(caption);
    if (!parsed.ingredients.length && !parsed.steps.length) {
      setError("Couldn't find ingredients/steps in that text. Make sure it includes an \"ingredients:\" and a \"method:\" section, or just add them manually.");
      return;
    }
    setPrefill(emptyDraft({
      title: parsed.title ?? "",
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      source_url: url || null,
    }));
    setTab("manual");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "url", label: "Paste URL" },
    { id: "text", label: "Paste text" },
    { id: "manual", label: "Manual" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Add a recipe</h1>

      <div className="mb-6 flex gap-1 rounded-xl border border-neutral-200 p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
            className={`flex-1 rounded-lg py-2 text-sm ${tab === t.id ? "bg-neutral-900 text-white" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "url" && (
        <form onSubmit={importUrl} className="space-y-3">
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required
            placeholder="https://example.com/best-pasta"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={importing}
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {importing ? "Reading page…" : "Import recipe"}
          </button>
          <p className="text-xs text-neutral-500">
            Works best on recipe websites. For Instagram/TikTok, use <b>Paste text</b>.
          </p>
        </form>
      )}

      {tab === "text" && (
        <form onSubmit={parseText} className="space-y-3">
          <p className="text-sm text-neutral-500">
            Copy the caption/description (the part with the ingredients and steps) and paste it here.
          </p>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={10} required
            placeholder={"e.g.\n\nred chicken recipe:\ningredients:\n• 1 kg chicken\n• 15 almonds\n...\nmethod:\n1. grind the nuts...\n2. marinate..."}
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit"
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
            Parse text
          </button>
          <p className="text-xs text-neutral-500">We&apos;ll split ingredients and steps for you — review before saving.</p>
        </form>
      )}

      {tab === "manual" && (
        <RecipeForm initial={prefill ?? undefined} onSubmit={saveNewRecipe} submitLabel="Save recipe" />
      )}
    </div>
  );
}
