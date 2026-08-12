"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SocialButtons from "@/components/auth/SocialButtons";

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
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-neutral-500 hover:text-neutral-900">
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" /> or <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <SocialButtons />

      <p className="mt-6 text-center text-sm text-neutral-500">
        No account? <Link href="/signup" className="font-medium text-neutral-900 underline">Sign up</Link>
      </p>
    </div>
  );
}
