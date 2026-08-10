"use client";
import Link from "next/link";
import { useState } from "react";
import type { Recipe } from "@/types";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [imgError, setImgError] = useState(false);
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  const showImg = recipe.image_url && !imgError;

  return (
    <Link href={`/recipes/${recipe.id}`}
      className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url!} alt={recipe.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🍽️</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 font-medium">{recipe.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
          {total > 0 && <span>{total} min</span>}
          {recipe.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5">{t}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
