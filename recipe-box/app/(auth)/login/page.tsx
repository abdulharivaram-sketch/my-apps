"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  }

  const input =
    "w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900";

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-neutral-500">Sign in to your recipe box.</p>

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <input type="email" required placeholder="you@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)} className={input} />
        <input type="password" required placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={input} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" /> or <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <button onClick={handleGoogle}
        className="w-full rounded-xl border border-neutral-200 py-3 text-sm font-medium transition hover:bg-neutral-50">
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-neutral-500">
        No account? <Link href="/signup" className="font-medium text-neutral-900 underline">Sign up</Link>
      </p>
    </div>
  );
}
