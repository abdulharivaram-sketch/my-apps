import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeDraft } from "@/types";

export async function listRecipes(opts?: {
  search?: string; tag?: string; folderId?: string; includeArchived?: boolean;
}): Promise<Recipe[]> {
  const supabase = await createClient();
  let query = supabase.from("recipes").select("*").order("created_at", { ascending: false });

  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  if (opts?.tag) query = query.contains("tags", [opts.tag]);
  if (opts?.search) {
    const s = opts.search.replace(/[%,]/g, " ").trim();
    query = query.or(`title.ilike.%${s}%,ingredients.cs.[{"name":"${s}"}]`);
  }

  if (opts?.folderId) {
    const { data: links } = await supabase
      .from("recipe_folders").select("recipe_id").eq("folder_id", opts.folderId);
    const ids = (links ?? []).map((l) => l.recipe_id);
    if (!ids.length) return [];
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).single();
  return (data as Recipe) ?? null;
}

export async function getRecipeByShareId(shareId: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes").select("*").eq("share_id", shareId).eq("is_public", true).single();
  return (data as Recipe) ?? null;
}

export async function createRecipe(draft: RecipeDraft): Promise<Recipe> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("recipes").insert({ ...draft, user_id: user.id }).select("*").single();
  if (error) throw error;
  return data as Recipe;
}

export async function updateRecipe(id: string, patch: Partial<RecipeDraft>): Promise<Recipe> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

export async function setRecipePublic(id: string, isPublic: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}
