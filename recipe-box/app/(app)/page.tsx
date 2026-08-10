import { listRecipes } from "@/lib/data/recipes";
import RecipeGrid from "@/components/recipe/RecipeGrid";
import SearchBar from "@/components/library/SearchBar";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const recipes = await listRecipes({ search: q, tag });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recipe Box</h1>
        <span className="text-sm text-neutral-500">{recipes.length} recipes</span>
      </div>
      <SearchBar defaultValue={q} />
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
