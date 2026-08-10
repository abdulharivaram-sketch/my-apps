import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 px-4 text-center">
      <p className="text-4xl">🍽️</p>
      <h1 className="text-xl font-semibold">Recipe not found</h1>
      <Link href="/" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white">Back to your box</Link>
    </div>
  );
}
