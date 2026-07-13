"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import PageTransition from "@/components/ui/PageTransition";

const transmissionOptions = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "both", label: "Both" },
];

export default function InstructorOnboarding() {
  const [adiNumber, setAdiNumber] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [transmission, setTransmission] = useState("manual");
  const [areas, setAreas] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in first");
      setLoading(false);
      return;
    }

    let photoUrl = null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `instructors/${user.id}/photo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, photoFile, { upsert: true });

      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
    }

    const areasArray = areas
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from("instructors").insert({
      user_id: user.id,
      adi_number: adiNumber,
      bio,
      photo_url: photoUrl,
      hourly_rate: parseFloat(hourlyRate),
      transmission,
      areas_covered: areasArray,
      tags: ["ADI Verified"],
      status: "pending",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/instructor/dashboard");
    router.refresh();
  }

  return (
    <PageTransition>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-heading font-bold">
          Set Up Your Instructor Profile
        </h1>
        <p className="text-text-muted text-sm mt-2">
          Complete your profile to start receiving bookings
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="ADI Licence Number"
            placeholder="e.g. 123456"
            value={adiNumber}
            onChange={(e) => setAdiNumber(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Profile Photo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border file:border-border file:bg-surface
                file:text-text-primary file:text-sm file:font-medium
                hover:file:bg-panel file:cursor-pointer file:transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Bio
            </label>
            <textarea
              placeholder="Tell learners about your teaching style and experience..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl
                text-text-primary placeholder:text-text-muted resize-none
                focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40
                transition-colors"
              required
            />
          </div>

          <Input
            label="Hourly Rate (£)"
            type="number"
            placeholder="35"
            min="15"
            max="100"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Transmission
            </label>
            <div className="flex gap-2">
              {transmissionOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTransmission(opt.value)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    transmission === opt.value
                      ? "bg-blue-50 border-accent/30 text-accent"
                      : "bg-surface border-border text-text-muted hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Areas Covered"
            placeholder="Wolverhampton, Dudley, Walsall"
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            required
          />

          {error && (
            <p className="text-error text-sm text-center">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Complete Profile
          </Button>
        </form>
      </Card>
    </PageTransition>
  );
}
