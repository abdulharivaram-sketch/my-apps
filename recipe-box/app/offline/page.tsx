export const metadata = { title: "Offline · Recipe Box" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 px-6 text-center">
      <p className="text-4xl">📶</p>
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-neutral-500">
        Recipes you&apos;ve already opened are still available. Reconnect to load new ones,
        save changes, or build a grocery list.
      </p>
    </div>
  );
}
