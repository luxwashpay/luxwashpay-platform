"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";
import Link from "next/link";

interface Booking {
  id: string;
  lesson_type: string;
  price: number;
  instructor_payout: number;
  status: string;
  created_at: string;
  availability_slots: { start_time: string; end_time: string } | null;
  profiles: { full_name: string } | null;
}

export default function InstructorDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [instructorId, setInstructorId] = useState<string | null>(null);
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

      const { data: inst } = await supabase
        .from("instructors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!inst) {
        router.push("/onboarding/instructor");
        return;
      }

      setInstructorId(inst.id);

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(
          "*, availability_slots(start_time, end_time), profiles!learner_id(full_name)"
        )
        .eq("instructor_id", inst.id)
        .order("created_at", { ascending: false });

      setBookings((bookingsData as Booking[]) || []);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const today = new Date().toDateString();
  const todayBookings = bookings.filter(
    (b) =>
      b.availability_slots &&
      new Date(b.availability_slots.start_time).toDateString() === today &&
      b.status === "confirmed"
  );

  const thisMonth = new Date().getMonth();
  const monthBookings = bookings.filter(
    (b) =>
      new Date(b.created_at).getMonth() === thisMonth &&
      (b.status === "confirmed" || b.status === "completed")
  );
  const monthEarnings = monthBookings.reduce(
    (sum, b) => sum + b.instructor_payout,
    0
  );
  const totalLessons = bookings.filter(
    (b) => b.status === "completed"
  ).length;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-heading font-bold">
            Instructor Dashboard
          </h1>
          <div className="flex gap-2">
            <Link href="/instructor/availability">
              <Button size="sm" variant="secondary">Availability</Button>
            </Link>
            <Link href="/instructor/students">
              <Button size="sm" variant="secondary">Students</Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">This Month</p>
            <p className="text-xl font-heading font-bold text-accent">
              £{monthEarnings.toFixed(0)}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Total Lessons</p>
            <p className="text-xl font-heading font-bold">{totalLessons}</p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">This Month</p>
            <p className="text-xl font-heading font-bold">
              {monthBookings.length}
            </p>
          </Card>
        </div>

        {/* Today's Schedule */}
        <h2 className="text-lg font-heading font-bold mb-4">
          Today&apos;s Schedule
        </h2>
        {todayBookings.length === 0 ? (
          <Card className="text-center py-8 mb-6">
            <p className="text-text-muted text-sm">
              No lessons scheduled for today
            </p>
          </Card>
        ) : (
          <div className="space-y-3 mb-6">
            {todayBookings.map((booking) => (
              <Card key={booking.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-accent font-heading font-bold text-lg">
                        {booking.availability_slots &&
                          new Date(
                            booking.availability_slots.start_time
                          ).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">
                        {booking.profiles?.full_name || "Learner"}
                      </p>
                      <p className="text-text-muted text-sm">
                        {booking.lesson_type?.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <Link href={`/instructor/log/${booking.id}`}>
                    <Button size="sm" variant="secondary">
                      Log Lesson
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Recent Bookings */}
        <h2 className="text-lg font-heading font-bold mb-4">
          Recent Bookings
        </h2>
        <div className="space-y-3">
          {bookings.slice(0, 10).map((booking) => (
            <Card key={booking.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {booking.profiles?.full_name || "Learner"}
                  </p>
                  <p className="text-text-muted text-xs">
                    {new Date(booking.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium">
                    £{booking.instructor_payout.toFixed(0)}
                  </p>
                  <Badge
                    variant={
                      booking.status === "completed"
                        ? "success"
                        : booking.status === "confirmed"
                          ? "warning"
                          : "default"
                    }
                  >
                    {booking.status}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
