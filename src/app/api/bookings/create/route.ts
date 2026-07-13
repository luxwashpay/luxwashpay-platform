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

  const body = await request.json();
  const {
    instructor_id,
    school_id,
    slot_id,
    lesson_type,
    price,
    platform_fee,
    instructor_payout,
    payment_method,
  } = body;

  if (!instructor_id || !slot_id || !price) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const { data: slot } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("id", slot_id)
    .eq("is_booked", false)
    .single();

  if (!slot) {
    return NextResponse.json(
      { error: "Slot is no longer available" },
      { status: 409 }
    );
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      learner_id: user.id,
      instructor_id,
      school_id: school_id || null,
      slot_id,
      lesson_type,
      price,
      platform_fee,
      instructor_payout,
      payment_method,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (bookingError) {
    return NextResponse.json(
      { error: bookingError.message },
      { status: 500 }
    );
  }

  await supabase
    .from("availability_slots")
    .update({ is_booked: true })
    .eq("id", slot_id);

  // TODO: Integrate Mangopay PayIn or GoCardless payment here
  // For now, booking is created with status 'confirmed'

  return NextResponse.json({ booking_id: booking.id });
}
