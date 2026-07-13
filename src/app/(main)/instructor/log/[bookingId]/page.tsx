"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageTransition from "@/components/ui/PageTransition";

const MANEUVERS = [
  "Parallel Parking",
  "Roundabouts",
  "Dual Carriageway",
  "Bay Parking",
  "Emergency Stop",
  "Reverse Around Corner",
  "Night Driving",
  "Motorway Driving",
];

export default function LogLessonPage() {
  const params = useParams();
  const router = useRouter();
  const [selectedManeuvers, setSelectedManeuvers] = useState<Set<string>>(
    new Set()
  );
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function toggleManeuver(m: string) {
    const next = new Set(selectedManeuvers);
    if (next.has(m)) {
      next.delete(m);
      const nextRatings = { ...ratings };
      delete nextRatings[m];
      setRatings(nextRatings);
    } else {
      next.add(m);
      setRatings({ ...ratings, [m]: 3 });
    }
    setSelectedManeuvers(next);
  }

  async function handleSubmit() {
    setLoading(true);

    const res = await fetch("/api/lessons/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: params.bookingId,
        maneuvers_covered: Array.from(selectedManeuvers),
        confidence_ratings: ratings,
        notes,
      }),
    });

    if (res.ok) {
      setSuccess(true);
    }

    setLoading(false);
  }

  if (success) {
    return (
      <PageTransition>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-6" />
          <h1 className="text-2xl font-heading font-bold mb-3">
            Lesson Logged!
          </h1>
          <p className="text-text-muted mb-6">
            The learner&apos;s Progress Passport has been updated.
          </p>
          <Button onClick={() => router.push("/instructor/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-2">
          Log Lesson
        </h1>
        <p className="text-text-muted text-sm mb-6">
          Select maneuvers practiced and rate confidence
        </p>

        <Card className="mb-6">
          <h2 className="text-lg font-heading font-bold mb-4">
            Maneuvers Covered
          </h2>
          <div className="space-y-3">
            {MANEUVERS.map((m) => {
              const selected = selectedManeuvers.has(m);
              return (
                <div key={m}>
                  <button
                    onClick={() => toggleManeuver(m)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      selected
                        ? "bg-blue-50 border-accent/30"
                        : "bg-white border-border hover:border-accent/20"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        selected
                          ? "bg-accent border-accent"
                          : "border-border"
                      }`}
                    >
                      {selected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">{m}</span>
                  </button>

                  {selected && (
                    <div className="mt-2 ml-8 flex items-center gap-1">
                      <span className="text-text-muted text-xs mr-2">
                        Confidence:
                      </span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() =>
                            setRatings({ ...ratings, [m]: star })
                          }
                          className="p-0.5"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill={
                              star <= (ratings[m] || 0) ? "#2563eb" : "none"
                            }
                            stroke="#2563eb"
                            strokeWidth="2"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="mb-6">
          <h2 className="text-lg font-heading font-bold mb-3">Notes</h2>
          <textarea
            placeholder="Any notes about the lesson..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 bg-white border border-border rounded-lg
              text-text-primary placeholder:text-text-muted resize-none
              focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors"
          />
        </Card>

        <Button
          className="w-full"
          size="lg"
          loading={loading}
          disabled={selectedManeuvers.size === 0}
          onClick={handleSubmit}
        >
          Submit Lesson Log
        </Button>
      </div>
    </PageTransition>
  );
}
