"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Car, GraduationCap, Building2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import PageTransition from "@/components/ui/PageTransition";

type Role = "learner" | "instructor" | "school_admin";

const roles: { value: Role; label: string; description: string; icon: typeof Car }[] = [
  { value: "learner", label: "Learner", description: "I want to find and book driving lessons", icon: Car },
  { value: "instructor", label: "Instructor", description: "I'm a driving instructor looking for students", icon: GraduationCap },
  { value: "school_admin", label: "Driving School", description: "I run a driving school with multiple instructors", icon: Building2 },
];

export default function SignupPage() {
  const [step, setStep] = useState<"role" | "details">("role");
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { full_name: fullName, role } },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, role, full_name: fullName, phone });
      if (role === "instructor") router.push("/onboarding/instructor");
      else if (role === "school_admin") router.push("/onboarding/school");
      else router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <PageTransition>
      <div className="text-center mb-8">
        <Link href="/"><h1 className="text-3xl font-heading font-bold">Drive<span className="text-accent">Now</span></h1></Link>
        <p className="text-text-muted text-sm mt-2">Create your account</p>
      </div>
      {step === "role" ? (
        <div className="space-y-3">
          {roles.map((r) => (
            <Card key={r.value} hover onClick={() => { setRole(r.value); setStep("details"); }}
              className={`flex items-center gap-4 cursor-pointer transition-all ${role === r.value ? "border-accent/50" : ""}`}>
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <r.icon className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="font-medium text-text-primary">{r.label}</p>
                <p className="text-text-muted text-sm">{r.description}</p>
              </div>
            </Card>
          ))}
          <p className="text-center text-text-muted text-sm mt-6">
            Already have an account?{" "}<Link href="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      ) : (
        <Card>
          <button onClick={() => setStep("role")} className="text-text-muted text-sm hover:text-text-primary transition-colors mb-4 flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Change role
          </button>
          <div className="flex items-center gap-2 mb-6 px-3 py-2 bg-surface rounded-lg">
            {role && (() => { const r = roles.find((r) => r.value === role); return r ? <r.icon className="w-5 h-5 text-accent" /> : null; })()}
            <span className="text-sm font-medium">Signing up as {roles.find((r) => r.value === role)?.label}</span>
          </div>
          <form onSubmit={handleSignup} className="space-y-4">
            <Input label="Full Name" placeholder="John Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Phone Number" type="tel" placeholder="07700 900000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Input label="Password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            {error && <p className="text-error text-sm text-center">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">Create Account</Button>
          </form>
          <p className="text-center text-text-muted text-sm mt-6">
            Already have an account?{" "}<Link href="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </Card>
      )}
    </PageTransition>
  );
}
