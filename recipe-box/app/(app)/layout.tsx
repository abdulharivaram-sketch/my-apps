import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import BottomNav from "@/components/nav/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
