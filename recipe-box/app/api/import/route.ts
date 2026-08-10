import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRecipeFromUrl } from "@/lib/import/parse-recipe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let url: string;
  try {
    ({ url } = await request.json());
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Please provide a valid http(s) URL." }, { status: 400 });
  }

  try {
    const draft = await parseRecipeFromUrl(url);
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that page. You can still add the recipe manually." },
      { status: 422 }
    );
  }
}
