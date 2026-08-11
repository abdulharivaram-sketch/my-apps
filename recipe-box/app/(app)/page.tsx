import { listRecipes } from "@/lib/data/recipes";
import { listFolders } from "@/lib/data/folders";
import RecipeGrid from "@/components/recipe/RecipeGrid";
import SearchBar from "@/components/library/SearchBar";
import FolderBar from "@/components/library/FolderBar";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; tag?: string };
}) {
  const { q, tag } = searchParams;
  const [recipes, folders] = await Promise.all([
    listRecipes({ search: q, tag }),
    listFolders(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recipe Box</h1>
        <span className="text-sm text-neutral-500">{recipes.length} recipes</span>
      </div>

      <SearchBar defaultValue={q} />
      <FolderBar folders={folders} />
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
