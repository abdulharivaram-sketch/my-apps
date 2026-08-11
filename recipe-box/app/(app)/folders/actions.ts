"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createFolder, deleteFolder, addRecipeToFolder, removeRecipeFromFolder,
} from "@/lib/data/folders";
import type { Folder } from "@/types";

export async function createFolderAction(name: string): Promise<Folder> {
  const folder = await createFolder(name);
  revalidatePath("/");
  return folder;
}

export async function addToFolderAction(recipeId: string, folderId: string) {
  await addRecipeToFolder(recipeId, folderId);
  revalidatePath("/");
  revalidatePath(`/folders/${folderId}`);
}

export async function removeFromFolderAction(recipeId: string, folderId: string) {
  await removeRecipeFromFolder(recipeId, folderId);
  revalidatePath(`/folders/${folderId}`);
}

export async function deleteFolderAction(id: string) {
  await deleteFolder(id);
  revalidatePath("/");
  redirect("/");
}
