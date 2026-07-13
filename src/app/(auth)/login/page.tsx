"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import PageTransition from "@/components/ui/PageTransition";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const router = useRouter();
  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard"); router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setError(error.message); setLoading(false); return; }
    setMagicLinkSent(true); setLoading(false);
  }

  if (magicLinkSent) {
    return (
      <PageTransition>
        <Card className="text-center py-10">
          <Mail className="w-10 h-10 text-accent mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold mb-2">Check Your Email</h1>
          <p className="text-text-muted text-sm mb-6">
            We sent a magic link to <strong className="text-text-primary">{email}</strong>. Click it to sign in.
          </p>
          <button onClick={() => setMagicLinkSent(false)} className="text-accent text-sm hover:underline">Try a different email</button>
        </Card>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="text-center mb-8">
        <Link href="/"><h1 className="text-3xl font-heading font-bold">Drive<span className="text-accent">Now</span></h1></Link>
        <p className="text-text-muted text-sm mt-2">Welcome back</p>
      </div>
      <Card>
        <div className="flex gap-1 p-1 bg-surface rounded-lg mb-6">
          <button onClick={() => setMode("password")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "password" ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}>
            Password
          </button>
          <button onClick={() => setMode("magic")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "magic" ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}>
            Magic Link
          </button>
        </div>
        <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink} className="space-y-4">
          <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {mode === "password" && (
            <Input label="Password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          )}
          {error && <p className="text-error text-sm text-center">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">{mode === "password" ? "Sign In" : "Send Magic Link"}</Button>
        </form>
        <p className="text-center text-text-muted text-sm mt-6">
          Don&apos;t have an account?{" "}<Link href="/signup" className="text-accent hover:underline">Sign up</Link>
        </p>
      </Card>
    </PageTransition>
  );
}
