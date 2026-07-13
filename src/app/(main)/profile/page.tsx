"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageTransition from "@/components/ui/PageTransition";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile({ ...data, email: user.email });
      setLoading(false);
    }
    fetch();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) return null;

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Button onClick={() => router.push("/login")}>Sign In</Button>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6">Profile</h1>

        <Card className="mb-4">
          <div className="text-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-accent font-heading font-bold text-xl">
                {(profile.full_name || "?")
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")}
              </span>
            </div>
            <p className="font-heading font-bold text-lg">
              {profile.full_name}
            </p>
            <p className="text-text-muted text-sm">{profile.email}</p>
            <p className="text-text-muted text-xs capitalize mt-1">
              {profile.role?.replace("_", " ")}
            </p>
          </div>
        </Card>

        <div className="space-y-2 mb-6">
          {profile.role === "instructor" && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/instructor/dashboard")}
            >
              Instructor Dashboard
            </Button>
          )}
          {profile.role === "school_admin" && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/school/dashboard")}
            >
              School Dashboard
            </Button>
          )}
          {profile.role === "learner" && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/dashboard/progress")}
            >
              Progress Passport
            </Button>
          )}
          {profile.role === "platform_admin" && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/admin")}
            >
              Admin Dashboard
            </Button>
          )}
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </div>
    </PageTransition>
  );
}
