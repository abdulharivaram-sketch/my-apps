import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileMenu from "./ProfileMenu";

export default async function TopBar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, string>;

  const name = meta.full_name || meta.name || user?.email || "You";
  const email = user?.email ?? "";
  const avatar = meta.avatar_url || meta.picture || null;

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">🍳 Recipe Box</Link>
        <div className="flex items-center gap-2">
          <Link href="/recipes/new"
            className="hidden rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 sm:inline-block">
            ＋ New
          </Link>
          <Link href="/grocery" className="rounded-xl px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900">
            Grocery
          </Link>
          <ProfileMenu name={name} email={email} avatar={avatar} />
        </div>
      </div>
    </header>
  );
}
