"use server";
import { createListFromRecipes } from "@/lib/data/grocery";

export async function makeListFromRecipes(recipeIds: string[]) {
  return createListFromRecipes(recipeIds);
}
