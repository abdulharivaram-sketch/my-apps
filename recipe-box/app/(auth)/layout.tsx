// Auth pages instantiate the Supabase browser client, which needs the public env
// vars. Render them dynamically (per-request) rather than prerendering at build time,
// so the build never fails on a missing client and env is read at runtime.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
