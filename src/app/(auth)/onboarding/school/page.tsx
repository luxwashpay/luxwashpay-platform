"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import PageTransition from "@/components/ui/PageTransition";

export default function SchoolOnboarding() {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [areas, setAreas] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
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

    let logoUrl = null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `schools/${user.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, logoFile, { upsert: true });

      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        logoUrl = data.publicUrl;
      }
    }

    const areasArray = areas
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from("schools").insert({
      owner_id: user.id,
      name,
      tagline,
      description,
      logo_url: logoUrl,
      areas_covered: areasArray,
      phone,
      email,
      website,
      status: "pending",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/school/dashboard");
    router.refresh();
  }

  return (
    <PageTransition>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-heading font-bold">
          Register Your Driving School
        </h1>
        <p className="text-text-muted text-sm mt-2">
          List your school and instructors on DriveNow
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="School Name"
            placeholder="Elite Driving School"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Tagline"
            placeholder="Learn to drive with confidence"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              School Logo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border file:border-border file:bg-surface
                file:text-text-primary file:text-sm file:font-medium
                hover:file:bg-panel file:cursor-pointer file:transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Description
            </label>
            <textarea
              placeholder="Tell learners about your school..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl
                text-text-primary placeholder:text-text-muted resize-none
                focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40
                transition-colors"
              required
            />
          </div>

          <Input
            label="Areas Covered"
            placeholder="Wolverhampton, Dudley, Walsall"
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            required
          />

          <Input
            label="Phone"
            type="tel"
            placeholder="01902 123456"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Input
            label="Email"
            type="email"
            placeholder="info@elitedriving.co.uk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Website"
            type="url"
            placeholder="https://elitedriving.co.uk"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          {error && (
            <p className="text-error text-sm text-center">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Register School
          </Button>
        </form>
      </Card>
    </PageTransition>
  );
}
