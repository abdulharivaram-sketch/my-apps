"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); router.push(q ? `/?q=${encodeURIComponent(q)}` : "/"); }}
      className="relative"
    >
      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title or ingredient…"
        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900" />
    </form>
  );
}
