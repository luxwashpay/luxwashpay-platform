import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { booking_id, maneuvers_covered, confidence_ratings, notes } =
    await request.json();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, learner_id, instructor_id")
    .eq("id", booking_id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { data: inst } = await supabase
    .from("instructors")
    .select("id")
    .eq("user_id", user.id)
    .eq("id", booking.instructor_id)
    .single();

  if (!inst) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await supabase.from("lesson_logs").upsert({
    booking_id,
    instructor_id: booking.instructor_id,
    learner_id: booking.learner_id,
    maneuvers_covered,
    confidence_ratings,
    notes,
  });

  for (const maneuver of maneuvers_covered) {
    const confidenceScore = confidence_ratings[maneuver] || 3;

    const { data: existing } = await supabase
      .from("learner_progress")
      .select("*")
      .eq("learner_id", booking.learner_id)
      .eq("skill", maneuver)
      .single();

    const newMastery = existing
      ? Math.min(
          100,
          existing.mastery_level * 0.6 + confidenceScore * 20 * 0.4
        )
      : confidenceScore * 20;

    await supabase.from("learner_progress").upsert(
      {
        learner_id: booking.learner_id,
        skill: maneuver,
        mastery_level: Math.round(newMastery * 10) / 10,
        practice_count: (existing?.practice_count || 0) + 1,
        last_practiced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "learner_id,skill" }
    );
  }

  await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", booking_id);

  return NextResponse.json({ success: true });
}
