"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SocialButtons from "@/components/auth/SocialButtons";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
    setLoading(false);
    if (error) return setError(error.message);
    if (data.session) { router.push("/"); router.refresh(); }
    else setMsg("Check your email to confirm your account.");
  }

  const input =
    "w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900";

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight">Create your recipe box</h1>
      <form onSubmit={handleSignup} className="mt-6 space-y-4">
        <input type="email" required placeholder="you@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)} className={input} />
        <input type="password" required minLength={6} placeholder="Password (6+ chars)" value={password}
          onChange={(e) => setPassword(e.target.value)} className={input} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" /> or <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <SocialButtons />

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account? <Link href="/login" className="font-medium text-neutral-900 underline">Sign in</Link>
      </p>
    </div>
  );
}
