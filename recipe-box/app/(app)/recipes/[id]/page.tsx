import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import { listFolders, getRecipeFolderIds } from "@/lib/data/folders";
import CookingView from "@/components/recipe/CookingView";

export default async function RecipePage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();
  const [folders, folderIds] = await Promise.all([
    listFolders(),
    getRecipeFolderIds(params.id),
  ]);
  return <CookingView recipe={recipe} folders={folders} folderIds={folderIds} />;
}
