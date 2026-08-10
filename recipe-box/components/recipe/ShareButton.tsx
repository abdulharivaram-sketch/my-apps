"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ShareButton({
  recipeId, shareId, isPublic,
}: { recipeId: string; shareId: string; isPublic: boolean }) {
  const supabase = createClient();
  const [pub, setPub] = useState(isPublic);
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/share/${shareId}`;

  async function toggle() {
    const next = !pub;
    setPub(next);
    await supabase.from("recipes").update({ is_public: next }).eq("id", recipeId);
  }
  async function copy() {
    if (!pub) await toggle();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button onClick={copy}
      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
      {copied ? "Link copied!" : pub ? "🔗 Copy link" : "Share"}
    </button>
  );
}
