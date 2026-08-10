"use client";
import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();       // stop Chrome's mini-infobar
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setVisible(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={async () => {
        if (!deferred) return;
        await deferred.prompt();
        await deferred.userChoice;
        setVisible(false);
      }}
      className="fixed bottom-24 right-4 z-30 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg md:bottom-4"
    >
      ⬇︎ Install app
    </button>
  );
}
