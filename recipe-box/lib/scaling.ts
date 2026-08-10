import type { Ingredient } from "@/types";

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅛": 0.125,
};

/** Parse "1 1/2", "0.25", "½", "2-3" -> number | null */
export function parseQuantity(input: string | number | null): number | null {
  if (input == null) return null;
  if (typeof input === "number") return input;
  let s = input.trim();
  if (!s) return null;

  s = s.split(/\s*[-–]\s*/)[0].trim(); // low end of a range

  for (const [g, v] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(g)) s = s.replace(g, ` ${v}`).trim();
  }

  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (ing.quantity == null) return ing;
  return { ...ing, quantity: roundNice(ing.quantity * factor) };
}

export function roundNice(n: number): number {
  if (n >= 10) return Math.round(n);
  return Math.round(n * 100) / 100;
}

const DECIMAL_TO_FRACTION: [number, string][] = [
  [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"],
];

export function formatQuantity(q: number | null): string {
  if (q == null) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  const match = DECIMAL_TO_FRACTION.find(([d]) => Math.abs(d - frac) < 0.02);
  if (match) return `${whole > 0 ? whole : ""}${match[1]}`;
  return String(roundNice(q));
}
