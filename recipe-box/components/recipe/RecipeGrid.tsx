import type { Recipe } from "@/types";
import RecipeCard from "./RecipeCard";

export default function RecipeGrid({ recipes }: { recipes: Recipe[] }) {
  if (!recipes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
        <p className="text-4xl">🍲</p>
        <p className="mt-3 font-medium">Your recipe box is empty</p>
        <p className="mt-1 text-sm text-neutral-500">Paste a link or add a recipe to get started.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
    </div>
  );
}
