import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("webhook-signature");
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;

  if (secret && signature) {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = JSON.parse(rawBody);
  const supabase = await createServiceRoleClient();

  for (const event of body.events || []) {
    if (event.action === "paid_out" && event.resource_type === "payments") {
      const paymentId = event.links?.payment;

      if (paymentId) {
        const { data: booking } = await supabase
          .from("bookings")
          .select("*")
          .eq("gocardless_payment_id", paymentId)
          .single();

        if (booking) {
          await supabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", booking.id);

          // TODO: Trigger Mangopay transfer to instructor wallet
        }
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}
