"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";
import Link from "next/link";

export default function SchoolDashboard() {
  const [school, setSchool] = useState<any>(null);
  const [instructorCount, setInstructorCount] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [monthFees, setMonthFees] = useState(0);
  const [monthLessons, setMonthLessons] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: schoolData } = await supabase
        .from("schools")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (!schoolData) {
        router.push("/onboarding/school");
        return;
      }

      setSchool(schoolData);

      const { count } = await supabase
        .from("instructors")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolData.id)
        .eq("status", "active");

      setInstructorCount(count || 0);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: bookings } = await supabase
        .from("bookings")
        .select("price, platform_fee, created_at")
        .eq("school_id", schoolData.id)
        .gte("created_at", startOfMonth.toISOString())
        .in("status", ["confirmed", "completed"]);

      if (bookings) {
        setMonthRevenue(bookings.reduce((sum: number, booking: any) => sum + booking.price, 0));
        setMonthFees(bookings.reduce((sum: number, booking: any) => sum + booking.platform_fee, 0));
        setMonthLessons(bookings.length);
      }

      const weeks: any[] = [];
      for (let i = 7; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - i * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        const { data: weekBookings } = await supabase
          .from("bookings")
          .select("price")
          .eq("school_id", schoolData.id)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .in("status", ["confirmed", "completed"]);

        weeks.push({
          week: `W${8 - i}`,
          revenue: weekBookings?.reduce((sum: number, booking: any) => sum + booking.price, 0) || 0,
        });
      }
      setChartData(weeks);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">
              {school?.name}
            </h1>
            <p className="text-text-muted text-sm">School Dashboard</p>
          </div>
          <div className="flex gap-2">
            <Link href="/school/instructors">
              <Button size="sm" variant="secondary">Instructors</Button>
            </Link>
            <Link href="/school/bookings">
              <Button size="sm" variant="secondary">Bookings</Button>
            </Link>
            <Link href="/school/profile">
              <Button size="sm" variant="secondary">Profile</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Revenue</p>
            <p className="text-xl font-heading font-bold text-accent">
              £{monthRevenue.toFixed(0)}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Platform Fee (15%)</p>
            <p className="text-xl font-heading font-bold text-error">
              £{monthFees.toFixed(0)}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Lessons</p>
            <p className="text-xl font-heading font-bold">{monthLessons}</p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Instructors</p>
            <p className="text-xl font-heading font-bold">
              {instructorCount}
            </p>
          </Card>
        </div>

        {/* Earnings Chart */}
        <Card className="mb-6">
          <h2 className="text-lg font-heading font-bold mb-4">
            Weekly Earnings
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #1e2d45",
                  borderRadius: 8,
                  color: "#e2e8f4",
                }}
              />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </PageTransition>
  );
}
