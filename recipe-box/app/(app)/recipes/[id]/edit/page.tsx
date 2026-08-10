import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import EditClient from "./EditClient";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return <EditClient recipe={recipe} />;
}
