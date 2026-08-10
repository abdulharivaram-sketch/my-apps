"use client";
import RecipeForm from "@/components/recipe/RecipeForm";
import { saveRecipeEdit, removeRecipe } from "../../actions";
import type { Recipe, RecipeDraft } from "@/types";

export default function EditClient({ recipe }: { recipe: Recipe }) {
  const initial: RecipeDraft = {
    title: recipe.title, description: recipe.description, image_url: recipe.image_url,
    source_url: recipe.source_url, servings: recipe.servings,
    prep_minutes: recipe.prep_minutes, cook_minutes: recipe.cook_minutes,
    ingredients: recipe.ingredients, steps: recipe.steps, tags: recipe.tags,
  };
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Edit recipe</h1>
      <RecipeForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={(d) => saveRecipeEdit(recipe.id, d)}
        onDelete={() => removeRecipe(recipe.id)}
      />
    </div>
  );
}
