"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <WifiOff className="w-16 h-16 text-text-muted mx-auto mb-6" />
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-3">
          You&apos;re Offline
        </h1>
        <p className="text-text-muted text-base mb-8">
          It looks like you&apos;ve lost your internet connection. DriveNow needs
          a connection to load new pages, but previously visited pages may still
          be available.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-accent text-white font-body font-medium rounded-lg
            transition-transform active:scale-[0.97] hover:bg-accent-dark shadow-sm"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
