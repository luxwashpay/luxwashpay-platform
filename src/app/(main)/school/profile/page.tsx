"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PageTransition from "@/components/ui/PageTransition";

export default function SchoolProfilePage() {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [areas, setAreas] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [brandColor, setBrandColor] = useState("#2563eb");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: school } = await supabase
        .from("schools")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (school) {
        setSchoolId(school.id);
        setName(school.name || "");
        setTagline(school.tagline || "");
        setDescription(school.description || "");
        setAreas(school.areas_covered?.join(", ") || "");
        setPhone(school.phone || "");
        setEmail(school.email || "");
        setWebsite(school.website || "");
        setBrandColor(school.brand_color || "#2563eb");
      }
      setLoading(false);
    }
    fetch();
  }, []);

  async function handleSave() {
    if (!schoolId) return;
    setSaving(true);

    await supabase
      .from("schools")
      .update({
        name,
        tagline,
        description,
        areas_covered: areas.split(",").map((a) => a.trim()).filter(Boolean),
        phone,
        email,
        website,
        brand_color: brandColor,
      })
      .eq("id", schoolId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return null;

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6">
          School Profile
        </h1>

        <Card>
          <div className="space-y-4">
            <Input label="School Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
              />
            </div>
            <Input label="Areas Covered" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Wolverhampton, Dudley" />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Brand Colour</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <span className="text-text-muted text-sm">{brandColor}</span>
              </div>
            </div>
            <Button className="w-full" loading={saving} onClick={handleSave}>
              {saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
