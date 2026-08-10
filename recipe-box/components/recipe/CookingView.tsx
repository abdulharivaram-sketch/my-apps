"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/types";
import { scaleIngredient, formatQuantity } from "@/lib/scaling";
import { useWakeLock } from "@/lib/wake-lock";
import ServingScaler from "./ServingScaler";
import ShareButton from "./ShareButton";
import { removeRecipe } from "@/app/(app)/recipes/actions";

export default function CookingView({ recipe, readOnly = false }: { recipe: Recipe; readOnly?: boolean }) {
  const [servings, setServings] = useState(recipe.servings);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [imgError, setImgError] = useState(false);
  const { enabled, setEnabled, supported } = useWakeLock();
  const factor = servings / recipe.servings;

  const ingredients = useMemo(
    () => recipe.ingredients.map((i) => scaleIngredient(i, factor)),
    [recipe.ingredients, factor]
  );

  function toggle(i: number) {
    setDone((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }

  return (
    <article className="mx-auto max-w-3xl">
      {recipe.image_url && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.image_url} alt={recipe.title}
          onError={() => setImgError(true)}
          className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover" />
      ) : recipe.image_url ? (
        <div className="mb-4 flex aspect-[16/9] w-full flex-col items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
          <span className="text-4xl">🍽️</span>
          <span className="mt-2 text-xs">Image couldn&apos;t be loaded</span>
        </div>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight">{recipe.title}</h1>
      {recipe.description &&
        recipe.description.length < 200 &&
        !/ingredients?\s*:/i.test(recipe.description) && (
          <p className="mt-2 text-neutral-600">{recipe.description}</p>
        )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
        {recipe.prep_minutes != null && <span>Prep {recipe.prep_minutes}m</span>}
        {recipe.cook_minutes != null && <span>Cook {recipe.cook_minutes}m</span>}
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noreferrer" className="underline">Source</a>
        )}
      </div>

      <div className="sticky top-16 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white/90 p-3 backdrop-blur">
        <ServingScaler base={recipe.servings} value={servings} onChange={setServings} />
        <div className="flex items-center gap-2">
          {supported && (
            <button onClick={() => setEnabled(!enabled)}
              className={`rounded-xl px-3 py-2 text-sm ${enabled ? "bg-amber-100 text-amber-800" : "border border-neutral-200"}`}>
              {enabled ? "🔆 Screen on" : "🌙 Keep screen awake"}
            </button>
          )}
          {!readOnly && (
            <>
              <ShareButton recipeId={recipe.id} shareId={recipe.share_id} isPublic={recipe.is_public} />
              <Link href={`/recipes/${recipe.id}/edit`}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm">Edit</Link>
              <button
                onClick={async () => {
                  if (confirm("Delete this recipe? This can't be undone.")) {
                    await removeRecipe(recipe.id);
                  }
                }}
                className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <ul className="mt-3 space-y-1">
            {ingredients.map((ing, i) => (
              <li key={i}>
                <button onClick={() => toggle(i)}
                  className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-2 text-left text-[15px] hover:bg-neutral-50 ${done.has(i) ? "text-neutral-400 line-through" : ""}`}>
                  <span>
                    {(ing.quantity != null || ing.unit) && (
                      <span className="font-medium">
                        {formatQuantity(ing.quantity)}{ing.unit ? ` ${ing.unit}` : ""}{" "}
                      </span>
                    )}
                    {ing.name}{ing.note ? `, ${ing.note}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Steps</h2>
          <ol className="mt-3 space-y-4">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm text-white">{i + 1}</span>
                <p className="pt-0.5 text-[15px] leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
