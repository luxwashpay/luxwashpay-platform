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
  status: string;
  created_at: string;
  availability_slots: { start_time: string; end_time: string } | null;
  instructors: {
    id: string;
    profiles: { full_name: string } | null;
  } | null;
}

interface ProgressData {
  skill: string;
  mastery_level: number;
}

const SKILLS = [
  "Parallel Parking",
  "Roundabouts",
  "Dual Carriageway",
  "Bay Parking",
  "Emergency Stop",
  "Reverse Around Corner",
  "Night Driving",
  "Motorway Driving",
];

function calculateReadinessScore(
  progress: ProgressData[],
  totalLessons: number
): number {
  const lessonScore = Math.min(totalLessons / 30, 1) * 100;
  const practicedSkills = progress.filter((p) => p.mastery_level > 0);
  const breadthScore = (practicedSkills.length / 8) * 100;
  const avgMastery =
    practicedSkills.length > 0
      ? practicedSkills.reduce((sum, p) => sum + p.mastery_level, 0) /
        practicedSkills.length
      : 0;
  const trendScore = 50;

  return Math.round(
    lessonScore * 0.25 + breadthScore * 0.3 + avgMastery * 0.3 + trendScore * 0.15
  );
}

export default function LearnerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [progress, setProgress] = useState<ProgressData[]>([]);
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

      const [{ data: bookingsData }, { data: progressData }] =
        await Promise.all([
          supabase
            .from("bookings")
            .select(
              "*, availability_slots(start_time, end_time), instructors(id, profiles!instructors_user_id_fkey(full_name))"
            )
            .eq("learner_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("learner_progress")
            .select("skill, mastery_level")
            .eq("learner_id", user.id),
        ]);

      setBookings((bookingsData as Booking[]) || []);
      setProgress((progressData as ProgressData[]) || []);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const upcoming = bookings.filter(
    (b) =>
      b.status === "confirmed" &&
      b.availability_slots &&
      new Date(b.availability_slots.start_time) > new Date()
  );
  const past = bookings.filter(
    (b) =>
      b.status === "completed" ||
      (b.availability_slots &&
        new Date(b.availability_slots.start_time) <= new Date())
  );

  const completedLessons = past.length;
  const readinessScore = calculateReadinessScore(progress, completedLessons);
  const scoreColor =
    readinessScore >= 71
      ? "#059669"
      : readinessScore >= 41
        ? "#d97706"
        : "#dc2626";

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold mb-6">
          Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Upcoming Lesson */}
          <Card>
            <h2 className="text-sm font-heading font-bold text-text-muted mb-3">
              NEXT LESSON
            </h2>
            {upcoming.length > 0 ? (
              <div>
                <p className="font-medium text-lg">
                  {upcoming[0].instructors?.profiles?.full_name}
                </p>
                {upcoming[0].availability_slots && (
                  <>
                    <p className="text-text-muted text-sm mt-1">
                      {new Date(
                        upcoming[0].availability_slots.start_time
                      ).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    <p className="text-accent font-heading font-bold text-lg mt-1">
                      {new Date(
                        upcoming[0].availability_slots.start_time
                      ).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </>
                )}
                <Badge variant="success" className="mt-3">
                  Confirmed
                </Badge>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-text-muted text-sm mb-3">
                  No upcoming lessons
                </p>
                <Button size="sm" onClick={() => router.push("/search")}>
                  Book a Lesson
                </Button>
              </div>
            )}
          </Card>

          {/* Progress Passport Preview */}
          <Link href="/dashboard/progress">
            <Card hover className="h-full">
              <h2 className="text-sm font-heading font-bold text-text-muted mb-3">
                TEST READINESS
              </h2>
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={scoreColor}
                      strokeWidth="3"
                      strokeDasharray={`${readinessScore}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-xl font-heading font-bold"
                    style={{ color: scoreColor }}
                  >
                    {readinessScore}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {readinessScore >= 71
                      ? "Looking great!"
                      : readinessScore >= 41
                        ? "Making progress"
                        : "Just getting started"}
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    {completedLessons} lessons completed
                  </p>
                  <p className="text-accent text-xs mt-2">
                    View full passport →
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Past Lessons */}
        <h2 className="text-lg font-heading font-bold mb-4">
          Past Lessons
        </h2>
        {past.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-text-muted text-sm">
              No completed lessons yet. Book your first lesson!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {past.map((booking) => (
              <Card key={booking.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {booking.instructors?.profiles?.full_name || "Instructor"}
                    </p>
                    {booking.availability_slots && (
                      <p className="text-text-muted text-sm">
                        {new Date(
                          booking.availability_slots.start_time
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        booking.status === "completed" ? "success" : "default"
                      }
                    >
                      {booking.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        router.push(
                          `/book/${booking.instructors?.id}`
                        )
                      }
                    >
                      Rebook
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
