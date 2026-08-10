import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import CookingView from "@/components/recipe/CookingView";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return <CookingView recipe={recipe} />;
}
