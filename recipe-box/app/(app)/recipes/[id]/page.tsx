import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import CookingView from "@/components/recipe/CookingView";

export default async function RecipePage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();
  return <CookingView recipe={recipe} />;
}
