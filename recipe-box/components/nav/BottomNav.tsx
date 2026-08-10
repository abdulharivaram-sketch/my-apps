"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Box", icon: "🍳" },
  { href: "/recipes/new", label: "New", icon: "＋" },
  { href: "/grocery", label: "Grocery", icon: "🛒" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white md:hidden">
      <div className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-neutral-900" : "text-neutral-400"}`}>
              <span className="text-lg">{t.icon}</span>{t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
