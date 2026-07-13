import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { EventType, RessourceId } = body;

  const supabase = await createServiceRoleClient();

  switch (EventType) {
    case "PAYIN_NORMAL_SUCCEEDED": {
      const { data: booking } = await supabase
        .from("bookings")
        .select("*")
        .eq("mangopay_payin_id", RessourceId)
        .single();

      if (booking) {
        await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("id", booking.id);

        // TODO: Create Mangopay Transfer from platform wallet to instructor wallet
        // const mangopay = new MangopaySDK({ ... });
        // await mangopay.Transfers.create({
        //   AuthorId: platformUserId,
        //   DebitedFunds: { Currency: "GBP", Amount: booking.instructor_payout * 100 },
        //   Fees: { Currency: "GBP", Amount: 0 },
        //   DebitedWalletId: platformWalletId,
        //   CreditedWalletId: instructorWalletId,
        // });
      }
      break;
    }

    case "TRANSFER_NORMAL_SUCCEEDED": {
      const { data: booking } = await supabase
        .from("bookings")
        .select("*")
        .eq("mangopay_transfer_id", RessourceId)
        .single();

      if (booking) {
        // Transfer to instructor wallet completed
        // Funds are now available for instructor payout
      }
      break;
    }

    case "PAYOUT_NORMAL_SUCCEEDED": {
      // Instructor/school received payout to their bank account
      break;
    }
  }

  return NextResponse.json({ status: "ok" });
}
