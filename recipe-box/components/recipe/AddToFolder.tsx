"use client";
import { useEffect, useRef, useState } from "react";
import type { Folder } from "@/types";
import {
  createFolderAction, addToFolderAction, removeFromFolderAction,
} from "@/app/(app)/folders/actions";

export default function AddToFolder({
  recipeId, folders: initialFolders, memberIds,
}: { recipeId: string; folders: Folder[]; memberIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [members, setMembers] = useState<Set<string>>(new Set(memberIds));
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle(folderId: string) {
    const inIt = members.has(folderId);
    const next = new Set(members);
    inIt ? next.delete(folderId) : next.add(folderId);
    setMembers(next);
    if (inIt) await removeFromFolderAction(recipeId, folderId);
    else await addToFolderAction(recipeId, folderId);
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const folder = await createFolderAction(name);
      setFolders((f) => [...folders, folder]);
      setNewName("");
      await addToFolderAction(recipeId, folder.id);
      setMembers((m) => new Set([...m, folder.id]));
    } finally {
      setBusy(false);
    }
  }

  const count = members.size;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
        📁 {count > 0 ? `In ${count} folder${count > 1 ? "s" : ""}` : "Add to folder"}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          <div className="max-h-56 overflow-y-auto">
            {folders.length === 0 && (
              <p className="px-3 py-2 text-xs text-neutral-500">No folders yet — create one below.</p>
            )}
            {folders.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-50">
                <input type="checkbox" checked={members.has(f.id)} onChange={() => toggle(f.id)} className="h-4 w-4" />
                <span>{f.emoji ? `${f.emoji} ` : ""}{f.name}</span>
              </label>
            ))}
          </div>
          <div className="my-1 h-px bg-neutral-100" />
          <div className="flex items-center gap-2 p-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
              placeholder="New folder name"
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-neutral-900" />
            <button onClick={create} disabled={busy || !newName.trim()}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
