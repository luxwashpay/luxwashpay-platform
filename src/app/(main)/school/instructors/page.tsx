"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserPlus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";

interface SchoolInstructor {
  id: string;
  adi_number: string;
  hourly_rate: number;
  transmission: string;
  status: string;
  rating_avg: number;
  review_count: number;
  profiles: { full_name: string; phone: string } | null;
}

export default function SchoolInstructorsPage() {
  const [instructors, setInstructors] = useState<SchoolInstructor[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAdi, setNewAdi] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newTransmission, setNewTransmission] = useState("manual");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: school } = await supabase
      .from("schools")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!school) return;
    setSchoolId(school.id);

    const { data } = await supabase
      .from("instructors")
      .select("*, profiles!instructors_user_id_fkey(full_name, phone)")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });

    setInstructors((data as SchoolInstructor[]) || []);
    setLoading(false);
  }

  async function handleAddInstructor() {
    if (!schoolId) return;
    setSaving(true);

    await supabase.from("instructors").insert({
      school_id: schoolId,
      adi_number: newAdi,
      hourly_rate: parseFloat(newRate),
      transmission: newTransmission,
      status: "pending",
    });

    setShowModal(false);
    setNewName("");
    setNewAdi("");
    setNewPhone("");
    setNewRate("");
    setSaving(false);
    fetchData();
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-heading font-bold">Instructors</h1>
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Add Instructor
          </Button>
        </div>

        {instructors.length === 0 ? (
          <Card className="text-center py-12">
            <UserPlus className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-heading font-bold mb-2">
              No Instructors Yet
            </h3>
            <p className="text-text-muted text-sm mb-4">
              Add your first instructor to get started
            </p>
            <Button onClick={() => setShowModal(true)}>Add Instructor</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {instructors.map((inst) => (
              <Card key={inst.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {inst.profiles?.full_name || "Unnamed Instructor"}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-text-muted text-sm">
                        ADI: {inst.adi_number || "N/A"}
                      </span>
                      <span className="text-text-muted text-sm">
                        £{inst.hourly_rate}/hr
                      </span>
                      <span className="text-text-muted text-sm capitalize">
                        {inst.transmission}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        inst.status === "active"
                          ? "success"
                          : inst.status === "pending"
                            ? "warning"
                            : "error"
                      }
                    >
                      {inst.status}
                    </Badge>
                    <Button size="sm" variant="ghost">
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Add Instructor"
        >
          <div className="space-y-4">
            <Input
              label="Full Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Input
              label="ADI Number"
              value={newAdi}
              onChange={(e) => setNewAdi(e.target.value)}
              required
            />
            <Input
              label="Phone"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <Input
              label="Hourly Rate (£)"
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              required
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                Transmission
              </label>
              <div className="flex gap-2">
                {["manual", "automatic", "both"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewTransmission(t)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                      newTransmission === t
                        ? "bg-blue-50 border-accent/30 text-accent"
                        : "bg-white border-border text-text-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              loading={saving}
              onClick={handleAddInstructor}
            >
              Add Instructor
            </Button>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
