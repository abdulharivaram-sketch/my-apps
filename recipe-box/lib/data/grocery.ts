import { createClient } from "@/lib/supabase/server";
import { aggregateIngredients } from "@/lib/grocery";
import type { GroceryItem, GroceryList, Recipe } from "@/types";

export async function listGroceryLists(): Promise<GroceryList[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("grocery_lists").select("*").order("created_at", { ascending: false });
  return (data ?? []) as GroceryList[];
}

export async function getListWithItems(id: string) {
  const supabase = await createClient();
  const [{ data: list }, { data: items }] = await Promise.all([
    supabase.from("grocery_lists").select("*").eq("id", id).single(),
    supabase.from("grocery_items").select("*").eq("list_id", id).order("position"),
  ]);
  return { list: (list as GroceryList | null) ?? null, items: (items ?? []) as GroceryItem[] };
}

export async function createListFromRecipes(recipeIds: string[], name = "Shopping list") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: recipes } = await supabase.from("recipes").select("*").in("id", recipeIds);
  const items = aggregateIngredients(((recipes as Recipe[]) ?? []).map((r) => ({ recipe: r })));

  const { data: list, error } = await supabase
    .from("grocery_lists").insert({ user_id: user.id, name }).select("*").single();
  if (error) throw error;

  if (items.length) {
    await supabase.from("grocery_items").insert(
      items.map((it, i) => ({
        list_id: list.id, user_id: user.id, name: it.name,
        quantity: it.quantity, unit: it.unit, position: i,
        source_recipe: it.sources[0] ?? null,
      }))
    );
  }
  return list as GroceryList;
}
