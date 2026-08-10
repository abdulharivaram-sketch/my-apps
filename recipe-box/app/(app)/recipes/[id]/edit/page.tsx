import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import EditClient from "./EditClient";

export default async function EditPage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();
  return <EditClient recipe={recipe} />;
}
