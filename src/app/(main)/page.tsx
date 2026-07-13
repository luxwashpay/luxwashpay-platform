import { WifiOff } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="text-center max-w-xl">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8 text-accent" />
        </div>
        <p className="uppercase tracking-[0.3em] text-xs text-text-muted mb-4">
          LuxWash
        </p>
        <h1 className="text-3xl md:text-5xl font-heading font-bold text-text-primary mb-4">
          Service not available
        </h1>
        <p className="text-text-muted text-base md:text-lg leading-7">
          This payment service is currently unavailable. Please speak to the
          site team for assistance.
        </p>
      </div>
    </main>
  );
}
