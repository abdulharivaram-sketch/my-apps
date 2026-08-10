import { createClient } from "@/lib/supabase/server";
import type { Folder } from "@/types";

export async function listFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("folders").select("*").order("created_at");
  return (data ?? []) as Folder[];
}

export async function getFolder(id: string): Promise<Folder | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("folders").select("*").eq("id", id).single();
  return (data as Folder) ?? null;
}

export async function createFolder(name: string, emoji?: string): Promise<Folder> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("folders").insert({ user_id: user.id, name, emoji: emoji ?? null }).select("*").single();
  if (error) throw error;
  return data as Folder;
}

export async function addRecipeToFolder(recipeId: string, folderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("recipe_folders")
    .upsert({ recipe_id: recipeId, folder_id: folderId, user_id: user.id });
}

export async function removeRecipeFromFolder(recipeId: string, folderId: string) {
  const supabase = await createClient();
  await supabase.from("recipe_folders").delete()
    .eq("recipe_id", recipeId).eq("folder_id", folderId);
}
