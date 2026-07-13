"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import PageTransition from "@/components/ui/PageTransition";

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function init() {
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

      if (inst) {
        setInstructorId(inst.id);
        await fetchSlots(inst.id);
      }
      setLoading(false);
    }
    init();
  }, []);

  async function fetchSlots(instId: string) {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const { data } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("instructor_id", instId)
      .gte("start_time", startOfWeek.toISOString())
      .lt("start_time", endOfWeek.toISOString())
      .order("start_time");

    setSlots((data as Slot[]) || []);
  }

  async function toggleSlot(day: number, hour: number) {
    if (!instructorId) return;
    setSaving(true);

    const date = new Date(selectedDate);
    date.setDate(date.getDate() - date.getDay() + 1 + day);
    date.setHours(hour, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(hour + 1);

    const existing = slots.find(
      (s) =>
        new Date(s.start_time).getTime() === date.getTime() && !s.is_booked
    );

    if (existing) {
      await supabase.from("availability_slots").delete().eq("id", existing.id);
    } else {
      await supabase.from("availability_slots").insert({
        instructor_id: instructorId,
        start_time: date.toISOString(),
        end_time: endDate.toISOString(),
      });
    }

    await fetchSlots(instructorId);
    setSaving(false);
  }

  function isSlotAvailable(day: number, hour: number): boolean {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - date.getDay() + 1 + day);
    date.setHours(hour, 0, 0, 0);

    return slots.some(
      (s) =>
        new Date(s.start_time).getTime() === date.getTime() && !s.is_booked
    );
  }

  function isSlotBooked(day: number, hour: number): boolean {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - date.getDay() + 1 + day);
    date.setHours(hour, 0, 0, 0);

    return slots.some(
      (s) =>
        new Date(s.start_time).getTime() === date.getTime() && s.is_booked
    );
  }

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-heading font-bold">Availability</h1>
          <div className="flex gap-2 items-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 7);
                setSelectedDate(d);
                if (instructorId) fetchSlots(instructorId);
              }}
            >
              ← Prev
            </Button>
            <span className="text-sm text-text-muted">
              Week of{" "}
              {(() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - d.getDay() + 1);
                return d.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                });
              })()}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 7);
                setSelectedDate(d);
                if (instructorId) fetchSlots(instructorId);
              }}
            >
              Next →
            </Button>
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="p-2 text-text-muted text-xs">Time</div>
                {days.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid */}
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 gap-1">
                  <div className="p-2 text-text-muted text-xs flex items-center">
                    {hour}:00
                  </div>
                  {days.map((_, dayIdx) => {
                    const available = isSlotAvailable(dayIdx, hour);
                    const booked = isSlotBooked(dayIdx, hour);

                    return (
                      <button
                        key={dayIdx}
                        onClick={() => !booked && toggleSlot(dayIdx, hour)}
                        disabled={booked || saving}
                        className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                          booked
                            ? "bg-school-blue/10 text-school-blue border border-school-blue/20 cursor-not-allowed"
                            : available
                              ? "bg-success/10 text-success border border-success/20 hover:bg-success/20"
                              : "bg-surface border border-border text-text-muted hover:border-accent/30"
                        }`}
                      >
                        {booked ? "Booked" : available ? "Open" : "—"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mt-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-success/20 border border-success/30" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-school-blue/20 border border-school-blue/30" />
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-surface border border-border" />
              Unavailable
            </span>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
