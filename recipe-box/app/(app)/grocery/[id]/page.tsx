import { notFound } from "next/navigation";
import { getListWithItems } from "@/lib/data/grocery";
import GroceryListView from "@/components/grocery/GroceryList";

export default async function GroceryListPage({ params }: { params: { id: string } }) {
  const { list, items } = await getListWithItems(params.id);
  if (!list) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{list.name}</h1>
      <GroceryListView listId={list.id} initialItems={items} />
    </div>
  );
}
