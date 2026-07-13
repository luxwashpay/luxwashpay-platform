"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackProfileView } from "@/components/PWAInstallPrompt";
import { UserX } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import StarRating from "@/components/ui/StarRating";
import Skeleton from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";

interface InstructorData {
  id: string;
  bio: string;
  photo_url: string | null;
  hourly_rate: number;
  transmission: string;
  areas_covered: string[];
  tags: string[];
  rating_avg: number;
  review_count: number;
  school_id: string | null;
  profiles: { full_name: string } | null;
  schools: { name: string; brand_color: string } | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
}

export default function InstructorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [instructor, setInstructor] = useState<InstructorData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    trackProfileView();

    async function fetch() {
      const { data: inst } = await supabase
        .from("instructors")
        .select("*, profiles!instructors_user_id_fkey(full_name), schools!instructors_school_id_fkey(name, brand_color)")
        .eq("id", params.id)
        .single();

      if (inst) {
        setInstructor(inst as InstructorData);

        const [{ data: revs }, { data: slotsData }] = await Promise.all([
          supabase
            .from("reviews")
            .select("*, profiles!learner_id(full_name)")
            .eq("instructor_id", params.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("availability_slots")
            .select("*")
            .eq("instructor_id", params.id)
            .eq("is_booked", false)
            .gte("start_time", new Date().toISOString())
            .order("start_time")
            .limit(30),
        ]);

        setReviews((revs as Review[]) || []);
        setSlots((slotsData as Slot[]) || []);
      }

      setLoading(false);
    }
    fetch();
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <UserX className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <h1 className="text-2xl font-heading font-bold mb-2">
          Instructor Not Found
        </h1>
        <p className="text-text-muted mb-6">
          This instructor may no longer be available.
        </p>
        <Button onClick={() => router.push("/search")}>
          Browse Instructors
        </Button>
      </div>
    );
  }

  const name = instructor.profiles?.full_name || "Instructor";

  const groupedSlots: Record<string, Slot[]> = {};
  slots.forEach((s) => {
    const day = new Date(s.start_time).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (!groupedSlots[day]) groupedSlots[day] = [];
    groupedSlots[day].push(s);
  });

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <Avatar src={instructor.photo_url} alt={name} size="xl" />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-heading font-bold">{name}</h1>
                  <p className="text-text-muted text-sm mt-1">
                    {instructor.areas_covered?.join(", ")}
                  </p>
                </div>
                <p className="text-2xl font-heading font-bold text-accent">
                  £{instructor.hourly_rate}
                  <span className="text-text-muted text-sm font-body font-normal">/hr</span>
                </p>
              </div>

              <div className="mt-3">
                <StarRating
                  rating={instructor.rating_avg}
                  count={instructor.review_count}
                  size="md"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge>
                  {instructor.transmission === "both"
                    ? "Manual & Automatic"
                    : instructor.transmission === "manual"
                      ? "Manual"
                      : "Automatic"}
                </Badge>
                {instructor.schools?.name && (
                  <Badge variant="blue">{instructor.schools.name}</Badge>
                )}
                {instructor.tags?.map((tag) => (
                  <Badge key={tag} variant="success">{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <Card>
              <h2 className="text-lg font-heading font-bold mb-3">About</h2>
              <p className="text-text-muted text-sm leading-relaxed">
                {instructor.bio || "No bio provided yet."}
              </p>
            </Card>

            {/* Availability */}
            <Card>
              <h2 className="text-lg font-heading font-bold mb-4">
                Available Slots
              </h2>
              {Object.keys(groupedSlots).length === 0 ? (
                <p className="text-text-muted text-sm">
                  No slots available right now. Check back soon!
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedSlots).map(([day, daySlots]) => (
                    <div key={day}>
                      <p className="text-sm font-medium text-text-primary mb-2">
                        {day}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() =>
                              router.push(
                                `/book/${instructor.id}?slot=${slot.id}`
                              )
                            }
                            className="px-3 py-1.5 text-sm bg-white border border-border rounded-lg
                              hover:border-accent/40 hover:text-accent transition-colors"
                          >
                            {new Date(slot.start_time).toLocaleTimeString(
                              "en-GB",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Reviews */}
            <Card>
              <h2 className="text-lg font-heading font-bold mb-4">
                Reviews ({instructor.review_count})
              </h2>
              {reviews.length === 0 ? (
                <p className="text-text-muted text-sm">No reviews yet.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">
                          {review.profiles?.full_name || "Learner"}
                        </p>
                        <StarRating rating={review.rating} />
                      </div>
                      {review.comment && (
                        <p className="text-text-muted text-sm">
                          {review.comment}
                        </p>
                      )}
                      <p className="text-text-muted text-xs mt-2">
                        {new Date(review.created_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sticky Sidebar */}
          <div className="hidden lg:block">
            <Card className="sticky top-20">
              <p className="text-2xl font-heading font-bold text-accent text-center mb-1">
                £{instructor.hourly_rate}
              </p>
              <p className="text-text-muted text-sm text-center mb-4">
                per hour
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push(`/book/${instructor.id}`)}
              >
                Book a Lesson
              </Button>
            </Card>
          </div>
        </div>

        {/* Mobile Sticky Book Button */}
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-border lg:hidden z-30">
          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push(`/book/${instructor.id}`)}
          >
            Book a Lesson — £{instructor.hourly_rate}/hr
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
