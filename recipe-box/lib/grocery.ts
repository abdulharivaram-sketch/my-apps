import type { Recipe } from "@/types";
import { roundNice } from "./scaling";

export interface AggregatedItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  sources: string[];
}

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function normUnit(u: string | null) {
  return (u ?? "").trim().toLowerCase();
}

export function aggregateIngredients(
  selections: { recipe: Recipe; factor?: number }[]
): AggregatedItem[] {
  const map = new Map<string, AggregatedItem>();

  for (const { recipe, factor = 1 } of selections) {
    for (const ing of recipe.ingredients) {
      const qty = ing.quantity == null ? null : roundNice(ing.quantity * factor);
      const key = `${normName(ing.name)}|${normUnit(ing.unit)}`;
      const existing = map.get(key);

      if (existing) {
        if (existing.quantity != null && qty != null) {
          existing.quantity = roundNice(existing.quantity + qty);
        } else if (qty != null) {
          existing.quantity = qty;
        }
        if (!existing.sources.includes(recipe.id)) existing.sources.push(recipe.id);
      } else {
        map.set(key, { name: ing.name.trim(), quantity: qty, unit: ing.unit, sources: [recipe.id] });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
