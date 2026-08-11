import type { Ingredient, RecipeDraft, Step } from "@/types";
import { parseQuantity } from "@/lib/scaling";

/** Decode HTML entities (named + numeric) found in og:tags and captions. */
export function decodeEntities(input: string): string {
  if (!input) return input;
  const named: Record<string, string> = {
    quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " ",
    "#39": "'", "#34": '"', hellip: "…", mdash: "—", ndash: "–", rsquo: "'", lsquo: "'",
  };
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z#0-9]+);/g, (m, name) => named[name] ?? m);
}
function codePoint(n: number): string {
  try { return Number.isFinite(n) ? String.fromCodePoint(n) : ""; } catch { return ""; }
}

/** Split "1 1/2 cups flour, sifted" into { quantity, unit, name, note }. */
export function parseIngredientLine(line: string): Ingredient {
  const raw = line.trim();
  const qtyMatch = raw.match(/^([\d./\s¼-¾⅐-⅞]+)?\s*(.*)$/u);
  const qtyStr = qtyMatch?.[1]?.trim() ?? "";
  let rest = qtyMatch?.[2]?.trim() ?? raw;

  // Clean leftovers from ranges ("4-5 chillies") and fraction suffixes ("1/4th tsp").
  rest = rest.replace(/^[–—-]\s*\d+(?:\/\d+)?\s*/, "").replace(/^(?:st|nd|rd|th)\b\s*/i, "");

  const KNOWN_UNITS = [
    "cups", "cup", "tbsp", "tablespoons", "tablespoon", "tsp", "teaspoons", "teaspoon",
    "g", "gm", "gms", "grams", "gram", "kg", "ml", "l", "litre", "liter", "oz", "ounces",
    "lb", "lbs", "pound", "pounds", "cloves", "clove", "pinch", "cans", "can", "sprig", "sprigs",
  ];
  let unit: string | null = null;
  const firstWord = rest.split(/\s+/)[0]?.toLowerCase();
  if (firstWord && KNOWN_UNITS.includes(firstWord)) {
    unit = firstWord;
    rest = rest.slice(firstWord.length).trim();
  }

  let note: string | null = null;
  const commaIdx = rest.indexOf(",");
  if (commaIdx > -1) {
    note = rest.slice(commaIdx + 1).trim() || null;
    rest = rest.slice(0, commaIdx).trim();
  }

  return { quantity: parseQuantity(qtyStr), unit, name: rest || raw, note };
}

// ---- section detection for pasted text ----
const ING_RE = /^ingredients?\b\s*:?\s*$|\bingredients?\s*:/i;
const METHOD_RE = /^(?:method|methods|instructions?|directions?|steps|preparation)\b\s*:?\s*$|(?:method|instructions?|directions?|preparation)\s*:/i;
const END_RE = /^(?:notes?|recipe notes?|nutrition|video|equipment|kitchen notes?|storage|to serve|filed under)\b/i;
const META_RE = /^(course|cuisine|keyword|servings?|prep time|cook time|total time|ingredients?|instructions?|method|directions?|nutrition|calories|author|by |print|pin|share|tweet|save|rate|from \d)\b/i;

const cleanBullet = (l: string) => l.replace(/^[-•*·▪●‣]\s*/, "").trim();
const cleanStep = (l: string) => l.replace(/^[-•*·▪●‣]\s*/, "").replace(/^\s*\d{1,2}[.)]\s*/, "").trim();
const isGroupHeader = (l: string) =>
  (/\s\/\s/.test(l) && !/\d/.test(l) && !l.includes(",")) || /^for the\b/i.test(l);
const isStepHeader = (l: string) =>
  !/[.:!?]$/.test(l) && l.split(/\s+/).length <= 6 &&
  (/^(prepare|for the|to make|assemble|method|instructions)\b/i.test(l) || /\s\/\s/.test(l));

/**
 * Parse a freeform recipe from pasted text — works for BOTH:
 *  - recipe websites (multi-line, "Ingredients"/"Instructions" headings, one item per line)
 *  - Instagram/TikTok captions (single line, "ingredients:" + bullets, numbered steps)
 */
export function parseCaptionRecipe(rawInput: string): {
  title: string | null; ingredients: Ingredient[]; steps: Step[];
} {
  const decoded = decodeEntities(rawInput).replace(/\r\n?/g, "\n");
  const lines = decoded.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
  const multiline = lines.length >= 4;

  // Title from an "X recipe:" pattern (common in captions).
  let title: string | null = null;
  const joined = decoded.replace(/\s+/g, " ");
  const rIdx = joined.toLowerCase().indexOf("recipe:");
  if (rIdx > 0) {
    let pre = joined.slice(0, rIdx);
    const cut = Math.max(pre.lastIndexOf('"'), pre.lastIndexOf("“"), pre.lastIndexOf(":"));
    if (cut !== -1) pre = pre.slice(cut + 1);
    pre = pre.replace(/^[\s"“”:-]+|[\s"“”:-]+$/g, "").trim();
    if (pre.length >= 2 && pre.length <= 90) title = pre;
  }
  // Otherwise, for multi-line text, use the first line if it isn't a metadata label.
  if (!title && multiline) {
    const first = lines[0];
    if (first && first.length >= 3 && first.length <= 100 && !META_RE.test(first)) {
      title = first.replace(/[-–]\s*$/, "").trim();
    }
  }

  if (multiline) {
    const ingIdx = lines.findIndex((l) => ING_RE.test(l));
    const methodIdx = ingIdx === -1 ? -1 : lines.findIndex((l, i) => i > ingIdx && METHOD_RE.test(l));
    const endIdx = methodIdx === -1 ? -1 : lines.findIndex((l, i) => i > methodIdx && END_RE.test(l));

    const ingredients = (ingIdx === -1 ? [] :
      lines.slice(ingIdx + 1, methodIdx === -1 ? undefined : methodIdx))
      .map(cleanBullet)
      .filter((l) => l.length > 1 && !isGroupHeader(l) && !ING_RE.test(l))
      .map(parseIngredientLine);

    const steps = (methodIdx === -1 ? [] :
      lines.slice(methodIdx + 1, endIdx === -1 ? undefined : endIdx))
      .map(cleanStep)
      .filter((l) => l.length > 1 && !isStepHeader(l))
      .map((t) => ({ text: t }));

    if (ingredients.length || steps.length) return { title, ingredients, steps };
  }

  // Single-line (Instagram/TikTok caption) fallback.
  const text = decoded.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const ingAt = lower.search(/ingredients?\s*:/);
  const methodAt = lower.search(/(?:method|methods|instructions?|directions?|steps|preparation)\s*:/);

  let ingredients: Ingredient[] = [];
  if (ingAt !== -1) {
    const start = lower.indexOf(":", ingAt) + 1;
    const end = methodAt !== -1 && methodAt > ingAt ? methodAt : text.length;
    const block = text.slice(start, end);
    const parts = /[•·▪●‣]/.test(block) ? block.split(/[•·▪●‣]/) : block.split(/\s*;\s*/);
    ingredients = parts.map((p) => p.trim()).filter((p) => p.length > 1).map(parseIngredientLine);
  }

  let steps: Step[] = [];
  if (methodAt !== -1) {
    let block = text.slice(lower.indexOf(":", methodAt) + 1);
    const hashAt = block.indexOf("#");
    if (hashAt !== -1) block = block.slice(0, hashAt);
    steps = block.split(/\s*(?:^|\s)\d{1,2}[.)]\s+/).map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t }));
  }

  return { title, ingredients, steps };
}

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function findRecipeNode(json: any): any | null {
  const nodes = Array.isArray(json) ? json : json["@graph"] ?? [json];
  for (const n of toArray(nodes)) {
    const type = n?.["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types?.includes("Recipe")) return n;
  }
  return null;
}

/** Fetch a URL and extract a best-effort RecipeDraft. Never throws on parse. */
export async function parseRecipeFromUrl(url: string): Promise<RecipeDraft> {
  // Recipe sites serve full HTML (with structured data) to a normal browser;
  // Instagram/Facebook/TikTok only give rich preview data to a link-preview crawler.
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* ignore */ }
  const isSocial = /(instagram\.com|instagr\.am|tiktok\.com|facebook\.com|fb\.watch)/.test(host);
  const userAgent = isSocial
    ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
    : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": userAgent }, signal: controller.signal });
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const draft: RecipeDraft = {
    title: "", description: null, image_url: null, source_url: url,
    servings: 2, prep_minutes: null, cook_minutes: null,
    ingredients: [], steps: [], tags: [],
  };

  // 1) Structured data (recipe websites)
  const ldMatches = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const m of ldMatches) {
    try {
      const node = findRecipeNode(JSON.parse(m[1].trim()));
      if (!node) continue;

      draft.title = decodeEntities(String(node.name ?? draft.title));
      draft.description = node.description ? decodeEntities(String(node.description)) : draft.description;

      const img = node.image;
      draft.image_url =
        typeof img === "string" ? img
        : Array.isArray(img) ? (typeof img[0] === "string" ? img[0] : img[0]?.url ?? null)
        : img?.url ?? draft.image_url;

      if (node.recipeYield) {
        const y = parseInt(String(toArray(node.recipeYield)[0]).replace(/\D/g, ""), 10);
        if (Number.isFinite(y) && y > 0) draft.servings = y;
      }
      draft.prep_minutes = isoDurationToMinutes(node.prepTime) ?? draft.prep_minutes;
      draft.cook_minutes = isoDurationToMinutes(node.cookTime) ?? draft.cook_minutes;

      draft.ingredients = toArray<string>(node.recipeIngredient).map((s) => parseIngredientLine(decodeEntities(s)));
      draft.steps = extractSteps(node.recipeInstructions);

      const kw = node.keywords;
      draft.tags = typeof kw === "string"
        ? kw.split(",").map((t: string) => t.trim()).filter(Boolean)
        : Array.isArray(kw) ? kw.map(String) : [];

      if (draft.title && draft.ingredients.length) return draft;
    } catch {
      // malformed JSON-LD block — try the next one
    }
  }

  // 2) Open Graph (title + image + caption text)
  const ogTitle = decodeEntities(meta(html, "og:title") ?? tag(html, "title") ?? "");
  const ogDesc = decodeEntities(meta(html, "og:description") ?? "");
  draft.image_url ||= meta(html, "og:image");
  draft.description ||=
    ogDesc && ogDesc.length < 300 && !/ingredients?\s*:/i.test(ogDesc) ? ogDesc : null;

  // 3) Caption parsing (Instagram / TikTok / plain-text posts)
  if (draft.ingredients.length === 0) {
    const caption = [ogDesc, ogTitle].find((c) => /ingredients?\s*:/i.test(c)) ?? "";
    if (caption) {
      const parsed = parseCaptionRecipe(caption);
      if (parsed.ingredients.length) draft.ingredients = parsed.ingredients;
      if (parsed.steps.length) draft.steps = parsed.steps;
      if (parsed.title) draft.title = parsed.title;
    }
  }

  if (!draft.title) {
    const t = ogTitle || "Untitled recipe";
    draft.title = t.length > 80 ? t.slice(0, 77).trim() + "…" : t;
  }

  return draft;
}

function extractSteps(instr: any): Step[] {
  const out: Step[] = [];
  for (const item of toArray(instr)) {
    if (typeof item === "string") out.push({ text: decodeEntities(item) });
    else if (item?.["@type"] === "HowToStep" && item.text) out.push({ text: decodeEntities(String(item.text)) });
    else if (item?.["@type"] === "HowToSection") out.push(...extractSteps(item.itemListElement));
    else if (item?.text) out.push({ text: decodeEntities(String(item.text)) });
  }
  return out;
}

function isoDurationToMinutes(iso?: string): number | null {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  return Number(m[1] || 0) * 60 + Number(m[2] || 0) || null;
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  return html.match(re)?.[1] ?? null;
}
function tag(html: string, name: string): string | null {
  return html.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, "i"))?.[1]?.trim() ?? null;
}
