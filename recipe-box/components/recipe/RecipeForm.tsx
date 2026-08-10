"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ingredient, RecipeDraft } from "@/types";

const EMPTY: RecipeDraft = {
  title: "", description: "", image_url: null, source_url: null,
  servings: 2, prep_minutes: null, cook_minutes: null,
  ingredients: [{ quantity: null, unit: null, name: "", note: null }],
  steps: [{ text: "" }], tags: [],
};

export default function RecipeForm({
  initial, onSubmit, submitLabel = "Save recipe", onDelete,
}: {
  initial?: RecipeDraft;
  onSubmit: (draft: RecipeDraft) => Promise<void>;
  submitLabel?: string;
  onDelete?: () => Promise<void>;
}) {
  const supabase = createClient();
  const [draft, setDraft] = useState<RecipeDraft>(initial ?? EMPTY);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const setIng = (i: number, patch: Partial<Ingredient>) =>
    set({ ingredients: draft.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const addIng = () =>
    set({ ingredients: [...draft.ingredients, { quantity: null, unit: null, name: "", note: null }] });
  const rmIng = (i: number) => set({ ingredients: draft.ingredients.filter((_, j) => j !== i) });

  const setStep = (i: number, text: string) =>
    set({ steps: draft.steps.map((x, j) => (j === i ? { text } : x)) });
  const addStep = () => set({ steps: [...draft.steps, { text: "" }] });
  const rmStep = (i: number) => set({ steps: draft.steps.filter((_, j) => j !== i) });

  async function handleImage(file: File) {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user!.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("recipe-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      set({ image_url: data.publicUrl });
    }
    setUploading(false);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !draft.tags.includes(t)) set({ tags: [...draft.tags, t] });
    setTagInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const clean: RecipeDraft = {
      ...draft,
      ingredients: draft.ingredients.filter((i) => i.name.trim()),
      steps: draft.steps.filter((s) => s.text.trim()),
    };
    await onSubmit(clean);
    setSaving(false);
  }

  const input =
    "w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900";

  return (
    <form onSubmit={submit} className="space-y-6">
      <input className={`${input} text-lg font-medium`} placeholder="Recipe title" required
        value={draft.title} onChange={(e) => set({ title: e.target.value })} />

      <textarea className={input} rows={2} placeholder="Short description (optional)"
        value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} />

      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
          {draft.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl">🍽️</div>
          )}
        </div>
        <label className="cursor-pointer rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
          {uploading ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm">Servings
          <input type="number" min={1} className={input} value={draft.servings}
            onChange={(e) => set({ servings: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Prep (min)
          <input type="number" min={0} className={input} value={draft.prep_minutes ?? ""}
            onChange={(e) => set({ prep_minutes: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="text-sm">Cook (min)
          <input type="number" min={0} className={input} value={draft.cook_minutes ?? ""}
            onChange={(e) => set({ cook_minutes: e.target.value ? Number(e.target.value) : null })} />
        </label>
      </div>

      <div>
        <h3 className="mb-2 font-medium">Ingredients</h3>
        <div className="space-y-2">
          {draft.ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${input} w-16`} placeholder="Qty" value={ing.quantity ?? ""}
                onChange={(e) => setIng(i, { quantity: e.target.value ? Number(e.target.value) : null })} />
              <input className={`${input} w-20`} placeholder="unit" value={ing.unit ?? ""}
                onChange={(e) => setIng(i, { unit: e.target.value || null })} />
              <input className={input} placeholder="ingredient" value={ing.name}
                onChange={(e) => setIng(i, { name: e.target.value })} />
              <button type="button" onClick={() => rmIng(i)} className="px-2 text-neutral-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addIng} className="mt-2 text-sm text-neutral-600 hover:text-neutral-900">＋ Add ingredient</button>
      </div>

      <div>
        <h3 className="mb-2 font-medium">Steps</h3>
        <div className="space-y-2">
          {draft.steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="pt-2 text-sm text-neutral-400">{i + 1}.</span>
              <textarea className={input} rows={2} placeholder="Describe this step" value={s.text}
                onChange={(e) => setStep(i, e.target.value)} />
              <button type="button" onClick={() => rmStep(i)} className="px-2 text-neutral-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep} className="mt-2 text-sm text-neutral-600 hover:text-neutral-900">＋ Add step</button>
      </div>

      <div>
        <h3 className="mb-2 font-medium">Tags</h3>
        <div className="mb-2 flex flex-wrap gap-1">
          {draft.tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-sm">
              {t}<button type="button" onClick={() => set({ tags: draft.tags.filter((x) => x !== t) })}>✕</button>
            </span>
          ))}
        </div>
        <input className={input} placeholder="Add a tag and press Enter" value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
          {saving ? "Saving…" : submitLabel}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete}
            className="rounded-xl px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">Delete</button>
        )}
      </div>
    </form>
  );
}
