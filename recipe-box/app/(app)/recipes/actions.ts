"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRecipe, updateRecipe, deleteRecipe } from "@/lib/data/recipes";
import type { RecipeDraft } from "@/types";

export async function saveNewRecipe(draft: RecipeDraft) {
  const recipe = await createRecipe(draft);
  revalidatePath("/");
  redirect(`/recipes/${recipe.id}`);
}

export async function saveRecipeEdit(id: string, draft: Partial<RecipeDraft>) {
  await updateRecipe(id, draft);
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

export async function removeRecipe(id: string) {
  await deleteRecipe(id);
  revalidatePath("/");
  redirect("/");
}
