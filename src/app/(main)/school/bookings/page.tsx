"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";

interface Booking {
  id: string;
  lesson_type: string;
  price: number;
  platform_fee: number;
  instructor_payout: number;
  status: string;
  payment_method: string;
  created_at: string;
  profiles: { full_name: string } | null;
  instructors: { profiles: { full_name: string } | null } | null;
  availability_slots: { start_time: string } | null;
}

export default function SchoolBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
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
        .from("bookings")
        .select(
          "*, profiles!bookings_learner_id_fkey(full_name), instructors(profiles!instructors_user_id_fkey(full_name)), availability_slots(start_time)"
        )
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setBookings((data as Booking[]) || []);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6">
          All Bookings
        </h1>

        {bookings.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-text-muted">No bookings yet.</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-text-muted font-medium">Learner</th>
                  <th className="text-left p-3 text-text-muted font-medium">Instructor</th>
                  <th className="text-left p-3 text-text-muted font-medium">Date</th>
                  <th className="text-left p-3 text-text-muted font-medium">Amount</th>
                  <th className="text-left p-3 text-text-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-border/50">
                    <td className="p-3">{b.profiles?.full_name || "—"}</td>
                    <td className="p-3">
                      {(b.instructors as any)?.profiles?.full_name || "—"}
                    </td>
                    <td className="p-3 text-text-muted">
                      {b.availability_slots
                        ? new Date(
                            b.availability_slots.start_time
                          ).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="p-3">£{b.price.toFixed(0)}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          b.status === "completed"
                            ? "success"
                            : b.status === "confirmed"
                              ? "warning"
                              : b.status === "cancelled"
                                ? "error"
                                : "default"
                        }
                      >
                        {b.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
