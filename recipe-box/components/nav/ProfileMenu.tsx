"use client";
import { useEffect, useRef, useState } from "react";

export default function ProfileMenu({
  name, email, avatar,
}: { name: string; email: string; avatar: string | null }) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (name || email || "?").trim().charAt(0).toUpperCase();
  const showAvatar = avatar && !imgError;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-sm font-medium text-neutral-700 hover:bg-neutral-200">
        {showAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar!} alt={name} onError={() => setImgError(true)} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-medium text-neutral-700">
              {showAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar!} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-neutral-500">{email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-neutral-100" />
          <form action="/auth/signout" method="post">
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
