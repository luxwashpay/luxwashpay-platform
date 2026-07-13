"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { PartyPopper, CreditCard, Landmark } from "lucide-react";
import PageTransition from "@/components/ui/PageTransition";

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
}

interface InstructorInfo {
  id: string;
  hourly_rate: number;
  profiles: { full_name: string } | null;
  schools: { name: string } | null;
  school_id: string | null;
}

const lessonTypes = [
  { value: "standard_1hr", label: "Standard Lesson", duration: "1 hour", multiplier: 1 },
  { value: "standard_2hr", label: "Extended Lesson", duration: "2 hours", multiplier: 2 },
  { value: "intensive", label: "Intensive Course", duration: "Full day", multiplier: 6 },
  { value: "mock_test", label: "Mock Test Prep", duration: "1.5 hours", multiplier: 1.5 },
];

export default function BookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const preSelectedSlot = searchParams.get("slot");

  const [step, setStep] = useState(1);
  const [instructor, setInstructor] = useState<InstructorInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>(preSelectedSlot || "");
  const [lessonType, setLessonType] = useState("standard_1hr");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer">("card");
  const [loading, setLoading] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const { data: inst } = await supabase
        .from("instructors")
        .select("id, hourly_rate, school_id, profiles!instructors_user_id_fkey(full_name), schools!instructors_school_id_fkey(name)")
        .eq("id", params.instructorId)
        .single();

      if (inst) setInstructor(inst as unknown as InstructorInfo);

      const { data: slotsData } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("instructor_id", params.instructorId)
        .eq("is_booked", false)
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(30);

      setSlots((slotsData as Slot[]) || []);
    }
    fetch();
  }, [params.instructorId]);

  const selectedLessonType = lessonTypes.find((t) => t.value === lessonType)!;
  const lessonPrice = instructor
    ? instructor.hourly_rate * selectedLessonType.multiplier
    : 0;
  const serviceFee = Math.round(lessonPrice * 0.1 * 100) / 100;
  const total = lessonPrice + serviceFee;
  const platformFee = Math.round(lessonPrice * 0.15 * 100) / 100;
  const instructorPayout = lessonPrice - platformFee;

  async function handleBooking() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructor_id: instructor?.id,
          school_id: instructor?.school_id,
          slot_id: selectedSlot,
          lesson_type: lessonType,
          price: lessonPrice,
          platform_fee: platformFee,
          instructor_payout: instructorPayout,
          payment_method: paymentMethod,
          learner_name: name,
          learner_phone: phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Booking failed");
        setLoading(false);
        return;
      }

      setBookingRef(data.booking_id?.slice(0, 8).toUpperCase() || "BOOKED");
      setBookingComplete(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  if (bookingComplete) {
    return (
      <PageTransition>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <PartyPopper className="w-16 h-16 text-accent mx-auto mb-6" />
          <h1 className="text-3xl font-heading font-bold mb-3">
            Booking Confirmed!
          </h1>
          <p className="text-text-muted mb-2">
            Your lesson with {instructor?.profiles?.full_name} has been booked.
          </p>
          <Card className="my-6">
            <p className="text-text-muted text-sm mb-1">Reference Number</p>
            <p className="text-2xl font-heading font-bold text-accent">
              #{bookingRef}
            </p>
          </Card>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push("/dashboard")}>
              View Bookings
            </Button>
            <Button variant="secondary" onClick={() => router.push("/search")}>
              Book Another
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

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
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-2">
          Book a Lesson
        </h1>
        <p className="text-text-muted text-sm mb-6">
          with {instructor?.profiles?.full_name || "Instructor"}
        </p>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                  step >= s
                    ? "bg-accent text-white"
                    : "bg-surface border border-border text-text-muted"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 flex-1 ${step > s ? "bg-accent" : "bg-border"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choose date/time */}
        {step === 1 && (
          <Card>
            <h2 className="text-lg font-heading font-bold mb-4">
              Choose Date & Time
            </h2>
            {Object.keys(groupedSlots).length === 0 ? (
              <p className="text-text-muted text-sm">No slots available.</p>
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
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                            selectedSlot === slot.id
                              ? "bg-blue-50 border-accent text-accent"
                              : "bg-white border-border text-text-muted hover:border-accent/40"
                          }`}
                        >
                          {new Date(slot.start_time).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Lesson Type</h3>
              <div className="grid grid-cols-2 gap-2">
                {lessonTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setLessonType(type.value)}
                    className={`p-3 text-left rounded-lg border transition-colors ${
                      lessonType === type.value
                        ? "bg-blue-50 border-accent/30"
                        : "bg-white border-border"
                    }`}
                  >
                    <p className="text-sm font-medium">{type.label}</p>
                    <p className="text-text-muted text-xs">{type.duration}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full mt-6"
              disabled={!selectedSlot}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </Card>
        )}

        {/* Step 2: Your details */}
        {step === 2 && (
          <Card>
            <h2 className="text-lg font-heading font-bold mb-4">
              Your Details
            </h2>
            <div className="space-y-4">
              <Input
                label="Full Name"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                placeholder="07700 900000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!name || !phone}
                onClick={() => setStep(3)}
              >
                Continue to Payment
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <h2 className="text-lg font-heading font-bold mb-4">
                Payment
              </h2>

              {/* Price Breakdown */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">
                    {selectedLessonType.label} ({selectedLessonType.duration})
                  </span>
                  <span>£{lessonPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Service fee (10%)</span>
                  <span>£{serviceFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span className="text-accent font-heading font-bold text-lg">
                    £{total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      paymentMethod === "card"
                        ? "bg-blue-50 border-accent/30"
                        : "bg-white border-border"
                    }`}
                  >
                    <p className="text-sm font-medium flex items-center gap-2"><CreditCard className="w-4 h-4" /> Card</p>
                    <p className="text-text-muted text-xs">Via Mangopay</p>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank_transfer")}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      paymentMethod === "bank_transfer"
                        ? "bg-blue-50 border-accent/30"
                        : "bg-white border-border"
                    }`}
                  >
                    <p className="text-sm font-medium flex items-center gap-2"><Landmark className="w-4 h-4" /> Bank Transfer</p>
                    <p className="text-text-muted text-xs">Via GoCardless</p>
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-error text-sm text-center mt-4">{error}</p>
              )}
            </Card>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                className="flex-1"
                loading={loading}
                onClick={handleBooking}
              >
                Pay £{total.toFixed(2)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
