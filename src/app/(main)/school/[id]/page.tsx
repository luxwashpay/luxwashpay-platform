"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2, Phone, Mail, Globe } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import Skeleton from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";
import Link from "next/link";

interface School {
  id: string;
  name: string;
  tagline: string;
  description: string;
  logo_url: string | null;
  brand_color: string;
  areas_covered: string[];
  website: string;
  phone: string;
  email: string;
}

interface SchoolInstructor {
  id: string;
  hourly_rate: number;
  transmission: string;
  rating_avg: number;
  review_count: number;
  areas_covered: string[];
  profiles: { full_name: string } | null;
}

export default function SchoolProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [instructors, setInstructors] = useState<SchoolInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const { data: schoolData } = await supabase
        .from("schools")
        .select("*")
        .eq("id", params.id)
        .single();

      if (schoolData) {
        setSchool(schoolData as School);

        const { data: instData } = await supabase
          .from("instructors")
          .select("*, profiles!instructors_user_id_fkey(full_name)")
          .eq("school_id", params.id)
          .eq("status", "active")
          .order("rating_avg", { ascending: false });

        setInstructors((instData as SchoolInstructor[]) || []);
      }

      setLoading(false);
    }
    fetch();
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <Building2 className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <h1 className="text-2xl font-heading font-bold mb-2">
          School Not Found
        </h1>
        <Button onClick={() => router.push("/search")}>Browse Instructors</Button>
      </div>
    );
  }

  const totalReviews = instructors.reduce((sum, i) => sum + i.review_count, 0);
  const avgRating =
    instructors.length > 0
      ? instructors.reduce((sum, i) => sum + i.rating_avg * i.review_count, 0) /
        Math.max(totalReviews, 1)
      : 0;

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* School Banner */}
        <Card
          className="mb-6 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${school.brand_color}15, transparent)`,
          }}
        >
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 text-white font-heading font-bold text-xl"
              style={{ backgroundColor: school.brand_color }}
            >
              {school.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold">
                {school.name}
              </h1>
              {school.tagline && (
                <p className="text-text-muted text-sm mt-1">{school.tagline}</p>
              )}
              <div className="flex items-center gap-4 mt-2">
                <StarRating rating={avgRating} count={totalReviews} />
                <span className="text-text-muted text-sm">
                  {instructors.length} instructors
                </span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            {school.description && (
              <Card>
                <h2 className="text-lg font-heading font-bold mb-3">About</h2>
                <p className="text-text-muted text-sm leading-relaxed">
                  {school.description}
                </p>
              </Card>
            )}

            {/* Instructors */}
            <div>
              <h2 className="text-lg font-heading font-bold mb-4">
                Our Instructors
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {instructors.map((inst) => (
                  <Link key={inst.id} href={`/instructor/${inst.id}`}>
                    <Card hover>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                          <span className="text-accent font-heading font-bold text-sm">
                            {(inst.profiles?.full_name || "??")
                              .split(" ")
                              .map((w: string) => w[0])
                              .join("")}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {inst.profiles?.full_name}
                          </p>
                          <StarRating rating={inst.rating_avg} count={inst.review_count} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge>
                          {inst.transmission === "both"
                            ? "Manual & Auto"
                            : inst.transmission === "manual"
                              ? "Manual"
                              : "Automatic"}
                        </Badge>
                        <p className="text-accent font-heading font-bold">
                          £{inst.hourly_rate}/hr
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-heading font-bold mb-3">
                School Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Instructors</span>
                  <span className="font-medium">{instructors.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Average Rating</span>
                  <span className="font-medium">{avgRating.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Total Reviews</span>
                  <span className="font-medium">{totalReviews}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-heading font-bold mb-3">
                Contact
              </h3>
              <div className="space-y-2 text-sm">
                {school.phone && (
                  <p className="text-text-muted flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {school.phone}
                  </p>
                )}
                {school.email && (
                  <p className="text-text-muted flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {school.email}
                  </p>
                )}
                {school.website && (
                  <p className="text-text-muted flex items-center gap-2">
                    <Globe className="w-4 h-4" /> {school.website}
                  </p>
                )}
              </div>
            </Card>

            {school.areas_covered?.length > 0 && (
              <Card>
                <h3 className="text-sm font-heading font-bold mb-3">
                  Areas Covered
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {school.areas_covered.map((area) => (
                    <Badge key={area}>{area}</Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
