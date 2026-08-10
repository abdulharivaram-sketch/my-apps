import Link from "next/link";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">🍳 Recipe Box</Link>
        <div className="flex items-center gap-2">
          <Link href="/recipes/new"
            className="hidden rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 sm:inline-block">
            ＋ New
          </Link>
          <Link href="/grocery" className="rounded-xl px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900">
            Grocery
          </Link>
          <form action="/auth/signout" method="post">
            <button className="rounded-xl px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
