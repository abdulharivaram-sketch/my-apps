import { notFound } from "next/navigation";
import { getFolder } from "@/lib/data/folders";
import { listRecipes } from "@/lib/data/recipes";
import RecipeGrid from "@/components/recipe/RecipeGrid";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const folder = await getFolder(id);
  if (!folder) notFound();
  const recipes = await listRecipes({ folderId: id });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {folder.emoji ? `${folder.emoji} ` : ""}{folder.name}
      </h1>
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
