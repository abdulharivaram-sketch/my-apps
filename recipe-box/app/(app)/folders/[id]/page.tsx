import Link from "next/link";
import { notFound } from "next/navigation";
import { getFolder } from "@/lib/data/folders";
import { listRecipes } from "@/lib/data/recipes";
import { deleteFolderAction } from "../actions";
import RecipeGrid from "@/components/recipe/RecipeGrid";

export default async function FolderPage({ params }: { params: { id: string } }) {
  const folder = await getFolder(params.id);
  if (!folder) notFound();
  const recipes = await listRecipes({ folderId: params.id });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">← All recipes</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {folder.emoji ? `${folder.emoji} ` : ""}{folder.name}
          </h1>
        </div>
        <form action={deleteFolderAction.bind(null, folder.id)}>
          <button className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            Delete folder
          </button>
        </form>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500">
          No recipes in this folder yet. Open a recipe and use <b>Add to folder</b>.
        </div>
      ) : (
        <RecipeGrid recipes={recipes} />
      )}
    </div>
  );
}
