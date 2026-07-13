"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";

interface Instructor {
  id: string;
  hourly_rate: number;
  transmission: string;
  profiles: { full_name: string } | null;
}

export default function SchoolPricingPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: school } = await supabase
        .from("schools")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (!school) return;

      const { data } = await supabase
        .from("instructors")
        .select("id, hourly_rate, transmission, profiles:instructors_user_id_fkey(full_name)")
        .eq("school_id", school.id)
        .order("hourly_rate", { ascending: false });

      setInstructors((data as unknown as Instructor[]) || []);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6">Pricing</h1>

        <Card className="mb-6 overflow-x-auto">
          <h2 className="text-lg font-heading font-bold mb-4">
            Instructor Rate Breakdown
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-text-muted font-medium">Instructor</th>
                <th className="text-left p-3 text-text-muted font-medium">Transmission</th>
                <th className="text-right p-3 text-text-muted font-medium">Rate</th>
                <th className="text-right p-3 text-text-muted font-medium">DriveNow Fee (15%)</th>
                <th className="text-right p-3 text-text-muted font-medium">Instructor Receives</th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((inst) => {
                const fee = inst.hourly_rate * 0.15;
                const payout = inst.hourly_rate - fee;
                return (
                  <tr key={inst.id} className="border-b border-border/50">
                    <td className="p-3 font-medium">
                      {inst.profiles?.full_name || "—"}
                    </td>
                    <td className="p-3 text-text-muted capitalize">
                      {inst.transmission}
                    </td>
                    <td className="p-3 text-right">£{inst.hourly_rate.toFixed(2)}</td>
                    <td className="p-3 text-right text-error">
                      -£{fee.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-success font-medium">
                      £{payout.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="text-lg font-heading font-bold mb-4">
            Lesson Packages
          </h2>
          <p className="text-text-muted text-sm mb-4">
            Create bundle packages to offer learners better value.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { lessons: 5, discount: 5 },
              { lessons: 10, discount: 10 },
              { lessons: 20, discount: 15 },
            ].map((pkg) => {
              const avgRate =
                instructors.length > 0
                  ? instructors.reduce((s, i) => s + i.hourly_rate, 0) /
                    instructors.length
                  : 35;
              const fullPrice = avgRate * pkg.lessons;
              const bundlePrice = fullPrice * (1 - pkg.discount / 100);

              return (
                <div
                  key={pkg.lessons}
                  className="p-4 bg-surface border border-border rounded-xl"
                >
                  <p className="text-lg font-heading font-bold">
                    {pkg.lessons} Lessons
                  </p>
                  <p className="text-text-muted text-sm line-through">
                    £{fullPrice.toFixed(0)}
                  </p>
                  <p className="text-accent font-heading font-bold text-xl">
                    £{bundlePrice.toFixed(0)}
                  </p>
                  <p className="text-success text-xs mt-1">
                    Save {pkg.discount}%
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
