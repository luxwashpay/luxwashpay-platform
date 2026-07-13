"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";

interface Student {
  learner_id: string;
  full_name: string;
  lesson_count: number;
  last_lesson: string;
  has_today_booking: boolean;
  today_booking_id: string | null;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
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

      if (!inst) return;

      const { data: bookings } = await supabase
        .from("bookings")
        .select(
          "id, learner_id, status, created_at, availability_slots(start_time), profiles!learner_id(full_name)"
        )
        .eq("instructor_id", inst.id)
        .in("status", ["confirmed", "completed"])
        .order("created_at", { ascending: false });

      if (!bookings) {
        setLoading(false);
        return;
      }

      const today = new Date().toDateString();
      const studentMap = new Map<string, Student>();

      for (const b of bookings as any[]) {
        const existing = studentMap.get(b.learner_id);
        const isToday =
          b.availability_slots?.start_time &&
          new Date(b.availability_slots.start_time).toDateString() === today &&
          b.status === "confirmed";

        if (!existing) {
          studentMap.set(b.learner_id, {
            learner_id: b.learner_id,
            full_name: b.profiles?.full_name || "Learner",
            lesson_count: 1,
            last_lesson: b.created_at,
            has_today_booking: isToday,
            today_booking_id: isToday ? b.id : null,
          });
        } else {
          existing.lesson_count++;
          if (isToday) {
            existing.has_today_booking = true;
            existing.today_booking_id = b.id;
          }
        }
      }

      setStudents(Array.from(studentMap.values()));
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

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6">
          My Students
        </h1>

        {students.length === 0 ? (
          <Card className="text-center py-12">
            <Users className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted">
              No students yet. They&apos;ll appear here after your first booking.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <Card key={student.learner_id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar alt={student.full_name} size="md" />
                    <div>
                      <p className="font-medium">{student.full_name}</p>
                      <p className="text-text-muted text-sm">
                        {student.lesson_count} lessons · Last:{" "}
                        {new Date(student.last_lesson).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "short" }
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {student.has_today_booking && student.today_booking_id && (
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/instructor/log/${student.today_booking_id}`
                          )
                        }
                      >
                        Log Lesson
                      </Button>
                    )}
                    <Button size="sm" variant="secondary">
                      View Progress
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
