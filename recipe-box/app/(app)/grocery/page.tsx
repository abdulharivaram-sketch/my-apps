import Link from "next/link";
import { listGroceryLists } from "@/lib/data/grocery";
import { listRecipes } from "@/lib/data/recipes";
import RecipePicker from "@/components/grocery/RecipePicker";

export default async function GroceryIndex() {
  const [lists, recipes] = await Promise.all([listGroceryLists(), listRecipes()]);
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">Grocery lists</h1>
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/grocery/${l.id}`}
                className="block rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:shadow-sm">
                {l.name}
              </Link>
            </li>
          ))}
          {!lists.length && <p className="text-sm text-neutral-500">No lists yet.</p>}
        </ul>
      </div>
      <div>
        <h2 className="mb-3 font-medium">New list from recipes</h2>
        {recipes.length ? (
          <RecipePicker recipes={recipes} />
        ) : (
          <p className="text-sm text-neutral-500">Add some recipes first.</p>
        )}
      </div>
    </div>
  );
}
