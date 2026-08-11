import Link from "next/link";
import { listRecipes } from "@/lib/data/recipes";
import { listFolders } from "@/lib/data/folders";
import RecipeGrid from "@/components/recipe/RecipeGrid";
import SearchBar from "@/components/library/SearchBar";

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

      {folders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500">Folders:</span>
          {folders.map((f) => (
            <Link key={f.id} href={`/folders/${f.id}`}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm hover:bg-neutral-50">
              {f.emoji ? `${f.emoji} ` : ""}{f.name}
            </Link>
          ))}
        </div>
      )}

      <RecipeGrid recipes={recipes} />
    </div>
  );
}
