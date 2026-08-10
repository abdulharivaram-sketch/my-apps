import { describe, expect, it } from "vitest";
import { parseQuantity, formatQuantity, scaleIngredient } from "@/lib/scaling";
import { aggregateIngredients } from "@/lib/grocery";
import type { Recipe } from "@/types";

describe("parseQuantity", () => {
  it("handles decimals, mixed, unicode, ranges", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("¾")).toBeCloseTo(0.75);
    expect(parseQuantity("2-3")).toBe(2);
    expect(parseQuantity("0.25")).toBe(0.25);
    expect(parseQuantity("to taste")).toBeNull();
  });
});

describe("scaling round-trip", () => {
  it("doubles and formats nicely", () => {
    const scaled = scaleIngredient({ quantity: 0.75, unit: "cup", name: "flour" }, 2);
    expect(scaled.quantity).toBe(1.5);
    expect(formatQuantity(scaled.quantity)).toBe("1½");
  });
});

describe("aggregateIngredients", () => {
  it("merges same name+unit, keeps different units separate", () => {
    const base = (over: Partial<Recipe>): Recipe => ({
      id: "r", user_id: "u", title: "", description: null, image_url: null, source_url: null,
      servings: 1, prep_minutes: null, cook_minutes: null, steps: [], tags: [],
      is_archived: false, is_public: false, share_id: "s",
      created_at: "", updated_at: "", ingredients: [], ...over,
    });
    const a = base({ id: "a", ingredients: [{ quantity: 1, unit: "cup", name: "flour" }] });
    const b = base({ id: "b", ingredients: [
      { quantity: 2, unit: "cup", name: "Flour" },
      { quantity: 100, unit: "g", name: "flour" },
    ] });
    const out = aggregateIngredients([{ recipe: a }, { recipe: b }]);
    const cupFlour = out.find((x) => x.unit === "cup");
    expect(cupFlour?.quantity).toBe(3);
    expect(out.filter((x) => x.name.toLowerCase() === "flour")).toHaveLength(2);
  });
});
