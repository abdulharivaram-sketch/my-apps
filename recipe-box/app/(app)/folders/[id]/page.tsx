import { notFound } from "next/navigation";
import { getFolder } from "@/lib/data/folders";
import { listRecipes } from "@/lib/data/recipes";
import RecipeGrid from "@/components/recipe/RecipeGrid";

export default async function FolderPage({ params }: { params: { id: string } }) {
  const folder = await getFolder(params.id);
  if (!folder) notFound();
  const recipes = await listRecipes({ folderId: params.id });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {folder.emoji ? `${folder.emoji} ` : ""}{folder.name}
      </h1>
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
