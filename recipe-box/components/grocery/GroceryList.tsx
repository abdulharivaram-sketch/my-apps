"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatQuantity } from "@/lib/scaling";
import type { GroceryItem } from "@/types";

export default function GroceryListView({
  listId, initialItems,
}: { listId: string; initialItems: GroceryItem[] }) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");

  async function toggle(item: GroceryItem) {
    const next = !item.is_checked;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_checked: next } : x)));
    await supabase.from("grocery_items").update({ is_checked: next }).eq("id", item.id);
  }
  async function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("grocery_items").delete().eq("id", id);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("grocery_items")
      .insert({ list_id: listId, user_id: user!.id, name: name.trim(), position: items.length })
      .select("*").single();
    if (data) setItems((xs) => [...xs, data as GroceryItem]);
    setName("");
  }

  const remaining = items.filter((i) => !i.is_checked).length;

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-500">{remaining} of {items.length} left</p>
      <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <input type="checkbox" checked={item.is_checked} onChange={() => toggle(item)} className="h-5 w-5 rounded" />
            <span className={`flex-1 ${item.is_checked ? "text-neutral-400 line-through" : ""}`}>
              {item.quantity != null && (
                <b>{formatQuantity(item.quantity)}{item.unit ? ` ${item.unit}` : ""} </b>
              )}
              {item.name}
            </span>
            <button onClick={() => remove(item.id)} className="text-neutral-300 hover:text-red-600">✕</button>
          </li>
        ))}
        {!items.length && <li className="px-4 py-6 text-center text-sm text-neutral-400">Empty list — add something below.</li>}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item…"
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-neutral-900" />
        <button className="rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white">Add</button>
      </form>
    </div>
  );
}
