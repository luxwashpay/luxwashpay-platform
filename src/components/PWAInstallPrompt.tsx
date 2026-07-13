"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("drivenow-pwa-dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!deferredPrompt) return;

    const checkViews = () => {
      const views = parseInt(
        localStorage.getItem("drivenow-profile-views") || "0",
        10
      );
      if (views >= 2) setShowBanner(true);
    };

    checkViews();
    window.addEventListener("drivenow-profile-view", checkViews);
    return () =>
      window.removeEventListener("drivenow-profile-view", checkViews);
  }, [deferredPrompt]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem("drivenow-pwa-dismissed", "true");
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden">
      <div className="glass-card p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <span className="text-accent font-heading font-bold text-lg">
            DN
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm font-medium">
            Add DriveNow to your home screen
          </p>
          <p className="text-text-muted text-xs mt-0.5">
            Book lessons in seconds
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-text-muted text-sm hover:text-text-primary transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="px-4 py-2 bg-accent text-bg text-sm font-medium rounded-lg
              transition-transform active:scale-[0.97]"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

export function trackProfileView() {
  const views = parseInt(
    localStorage.getItem("drivenow-profile-views") || "0",
    10
  );
  localStorage.setItem("drivenow-profile-views", String(views + 1));
  window.dispatchEvent(new Event("drivenow-profile-view"));
}
