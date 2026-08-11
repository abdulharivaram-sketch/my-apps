"use client";
import Link from "next/link";
import { useState } from "react";
import type { Folder } from "@/types";
import { createFolderAction } from "@/app/(app)/folders/actions";

export default function FolderBar({ folders: initial }: { folders: Folder[] }) {
  const [folders, setFolders] = useState<Folder[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const folder = await createFolderAction(n);
      setFolders((x) => [...x, folder]);
      setName("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-neutral-500">Folders:</span>

      {folders.map((f) => (
        <Link key={f.id} href={`/folders/${f.id}`}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm hover:bg-neutral-50">
          {f.emoji ? `${f.emoji} ` : ""}{f.name}
        </Link>
      ))}

      {adding ? (
        <span className="flex items-center gap-1">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); create(); }
              if (e.key === "Escape") { setAdding(false); setName(""); }
            }}
            placeholder="Folder name"
            className="w-36 rounded-full border border-neutral-300 px-3 py-1 text-sm outline-none focus:border-neutral-900" />
          <button onClick={create} disabled={busy || !name.trim()}
            className="rounded-full bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-40">Add</button>
          <button onClick={() => { setAdding(false); setName(""); }}
            className="px-2 text-sm text-neutral-500">Cancel</button>
        </span>
      ) : (
        <button onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50">
          ＋ New folder
        </button>
      )}
    </div>
  );
}
