"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SearchX } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";
import Link from "next/link";

interface Instructor {
  id: string;
  bio: string;
  photo_url: string | null;
  hourly_rate: number;
  transmission: string;
  areas_covered: string[];
  tags: string[];
  rating_avg: number;
  review_count: number;
  status: string;
  user_id: string;
  school_id: string | null;
  profiles: { full_name: string } | null;
  schools: { name: string } | null;
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [transmission, setTransmission] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(0);
  const [priceMin, setPriceMin] = useState<number>(15);
  const [priceMax, setPriceMax] = useState<number>(60);
  const [postcode, setPostcode] = useState(searchParams.get("postcode") || "");
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase
        .from("instructors")
        .select("*, profiles!instructors_user_id_fkey(full_name), schools!instructors_school_id_fkey(name)")
        .eq("status", "active")
        .gte("hourly_rate", priceMin)
        .lte("hourly_rate", priceMax)
        .gte("rating_avg", minRating)
        .order("rating_avg", { ascending: false });

      if (transmission) {
        query = query.or(`transmission.eq.${transmission},transmission.eq.both`);
      }

      const { data } = await query;
      setInstructors((data as Instructor[]) || []);
      setLoading(false);
    }
    fetch();
  }, [transmission, minRating, priceMin, priceMax]);

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold mb-6">
          Find Instructors
        </h1>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-72 shrink-0">
            <Card className="space-y-5 sticky top-20">
              <Input
                label="Postcode"
                placeholder="WV1 1AA"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Transmission</label>
                <div className="flex gap-2">
                  {[
                    { value: "", label: "All" },
                    { value: "manual", label: "Manual" },
                    { value: "automatic", label: "Auto" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTransmission(opt.value)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        transmission === opt.value
                          ? "bg-blue-50 border-accent/30 text-accent"
                          : "bg-white border-border text-text-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">
                  Price Range: £{priceMin} – £{priceMax}
                </label>
                <div className="flex gap-3">
                  <input type="range" min="15" max="60" value={priceMin}
                    onChange={(e) => setPriceMin(Number(e.target.value))} className="flex-1 accent-accent" />
                  <input type="range" min="15" max="60" value={priceMax}
                    onChange={(e) => setPriceMax(Number(e.target.value))} className="flex-1 accent-accent" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Minimum Rating</label>
                <div className="flex gap-1">
                  {[0, 3, 4, 4.5].map((r) => (
                    <button key={r} onClick={() => setMinRating(r)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        minRating === r ? "bg-blue-50 border-accent/30 text-accent" : "bg-white border-border text-text-muted"
                      }`}>
                      {r === 0 ? "Any" : `${r}+`}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </aside>

          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (<SkeletonCard key={i} />))}
              </div>
            ) : instructors.length === 0 ? (
              <Card className="text-center py-12">
                <SearchX className="w-10 h-10 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-heading font-bold mb-2">No instructors found</h3>
                <p className="text-text-muted text-sm mb-4">Try adjusting your filters or search area</p>
                <Button variant="secondary" onClick={() => { setTransmission(""); setMinRating(0); setPriceMin(15); setPriceMax(60); }}>
                  Reset Filters
                </Button>
              </Card>
            ) : (
              <>
                <p className="text-text-muted text-sm mb-4">
                  {instructors.length} instructor{instructors.length !== 1 ? "s" : ""} found
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {instructors.map((inst) => (
                    <Link key={inst.id} href={`/instructor/${inst.id}`}>
                      <Card hover>
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <span className="text-accent font-heading font-bold">
                              {(inst.profiles?.full_name || "??").split(" ").map((w: string) => w[0]).join("")}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">{inst.profiles?.full_name || "Instructor"}</p>
                            <p className="text-text-muted text-sm">{inst.areas_covered?.[0] || "Local area"}</p>
                          </div>
                        </div>
                        <StarRating rating={inst.rating_avg} count={inst.review_count} />
                        <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
                          <Badge>{inst.transmission === "both" ? "Manual & Auto" : inst.transmission === "manual" ? "Manual" : "Automatic"}</Badge>
                          {inst.schools?.name && (<Badge variant="blue">{inst.schools.name}</Badge>)}
                          {inst.tags?.slice(0, 2).map((tag: string) => (<Badge key={tag} variant="success">{tag}</Badge>))}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-heading font-bold text-accent">
                            £{inst.hourly_rate}<span className="text-text-muted text-sm font-body font-normal">/hr</span>
                          </p>
                          <Button size="sm">Book Now</Button>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
