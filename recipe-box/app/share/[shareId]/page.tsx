import { notFound } from "next/navigation";
import Link from "next/link";
import { getRecipeByShareId } from "@/lib/data/recipes";
import CookingView from "@/components/recipe/CookingView";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const recipe = await getRecipeByShareId(shareId);
  if (!recipe) notFound();

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <CookingView recipe={recipe} readOnly />
      <footer className="mx-auto mt-10 max-w-3xl border-t border-neutral-200 pt-6 text-center text-sm text-neutral-500">
        Made with <span className="font-medium text-neutral-900">Recipe Box</span> ·{" "}
        <Link href="/signup" className="underline">Save your own recipes</Link>
      </footer>
    </div>
  );
}
