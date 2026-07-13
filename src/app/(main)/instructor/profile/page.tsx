"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PageTransition from "@/components/ui/PageTransition";

export default function InstructorProfileEdit() {
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [transmission, setTransmission] = useState("manual");
  const [areas, setAreas] = useState("");
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: inst } = await supabase
        .from("instructors")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (inst) {
        setInstructorId(inst.id);
        setBio(inst.bio || "");
        setHourlyRate(String(inst.hourly_rate));
        setTransmission(inst.transmission || "manual");
        setAreas(inst.areas_covered?.join(", ") || "");
      }
      setLoading(false);
    }
    fetch();
  }, []);

  async function handleSave() {
    if (!instructorId) return;
    setSaving(true);

    await supabase
      .from("instructors")
      .update({
        bio,
        hourly_rate: parseFloat(hourlyRate),
        transmission,
        areas_covered: areas.split(",").map((a) => a.trim()).filter(Boolean),
      })
      .eq("id", instructorId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return null;

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6">
          Edit Profile
        </h1>

        <Card>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
              />
            </div>
            <Input
              label="Hourly Rate (£)"
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Transmission</label>
              <div className="flex gap-2">
                {["manual", "automatic", "both"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTransmission(t)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                      transmission === t
                        ? "bg-blue-50 border-accent/30 text-accent"
                        : "bg-surface border-border text-text-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Areas Covered"
              value={areas}
              onChange={(e) => setAreas(e.target.value)}
              placeholder="Wolverhampton, Dudley, Walsall"
            />
            <Button className="w-full" loading={saving} onClick={handleSave}>
              {saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
