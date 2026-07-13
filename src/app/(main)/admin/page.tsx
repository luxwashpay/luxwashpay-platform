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
import Badge from "@/components/ui/Badge";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";

interface School {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface PendingItem {
  id: string;
  type: "instructor" | "school";
  name: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [activeInstructors, setActiveInstructors] = useState(0);
  const [activeSchools, setActiveSchools] = useState(0);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "platform_admin") {
        router.push("/dashboard");
        return;
      }

      const [
        { data: bookings },
        { count: instCount },
        { count: schoolCount },
        { data: schoolsData },
        { data: pendingInstructors },
        { data: pendingSchools },
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "*, profiles!bookings_learner_id_fkey(full_name), instructors(profiles!instructors_user_id_fkey(full_name)), schools!bookings_school_id_fkey(name)"
          )
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("instructors")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("schools")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("schools")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("instructors")
          .select("id, created_at, profiles:instructors_user_id_fkey(full_name)")
          .eq("status", "pending"),
        supabase
          .from("schools")
          .select("id, name, created_at")
          .eq("status", "pending"),
      ]);

      if (bookings) {
        setTotalRevenue(bookings.reduce((sum: number, booking: any) => sum + booking.price, 0));
        setTotalFees(bookings.reduce((sum: number, booking: any) => sum + booking.platform_fee, 0));
        setRecentBookings(bookings);
      }

      setActiveInstructors(instCount || 0);
      setActiveSchools(schoolCount || 0);
      setSchools((schoolsData as School[]) || []);

      const pending: PendingItem[] = [
        ...(pendingInstructors || []).map((i: any) => ({
          id: i.id,
          type: "instructor" as const,
          name: i.profiles?.full_name || "Unknown",
          created_at: i.created_at,
        })),
        ...(pendingSchools || []).map((s: any) => ({
          id: s.id,
          type: "school" as const,
          name: s.name,
          created_at: s.created_at,
        })),
      ];
      setPendingItems(pending);

      const weeks: any[] = [];
      for (let i = 11; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - i * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        const weekBookings = (bookings || []).filter((b: any) => {
          const d = new Date(b.created_at);
          return d >= start && d < end;
        });

        weeks.push({
          week: `W${12 - i}`,
          revenue: weekBookings.reduce((sum: number, booking: any) => sum + booking.platform_fee, 0),
        });
      }
      setChartData(weeks);
      setLoading(false);
    }
    fetch();
  }, []);

  async function handleApprove(id: string, type: "instructor" | "school") {
    const table = type === "instructor" ? "instructors" : "schools";
    await supabase.from(table).update({ status: "active" }).eq("id", id);
    setPendingItems(pendingItems.filter((p) => p.id !== id));
  }

  async function handleReject(id: string, type: "instructor" | "school") {
    const table = type === "instructor" ? "instructors" : "schools";
    await supabase.from(table).update({ status: "suspended" }).eq("id", id);
    setPendingItems(pendingItems.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold mb-6">
          Platform Admin
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Total Revenue</p>
            <p className="text-xl font-heading font-bold">
              £{totalRevenue.toFixed(0)}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Platform Fees (15%)</p>
            <p className="text-xl font-heading font-bold text-accent">
              £{totalFees.toFixed(0)}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Active Instructors</p>
            <p className="text-xl font-heading font-bold">
              {activeInstructors}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-text-muted text-xs mb-1">Active Schools</p>
            <p className="text-xl font-heading font-bold">
              {activeSchools}
            </p>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card className="mb-6">
          <h2 className="text-lg font-heading font-bold mb-4">
            Platform Fee Revenue (12 Weeks)
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

        {/* Pending Approvals */}
        {pendingItems.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-lg font-heading font-bold mb-4">
              Pending Approvals ({pendingItems.length})
            </h2>
            <div className="space-y-3">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border"
                >
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={item.type === "school" ? "blue" : "default"}>
                        {item.type}
                      </Badge>
                      <span className="text-text-muted text-xs">
                        {new Date(item.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(item.id, item.type)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleReject(item.id, item.type)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Schools Table */}
        <Card className="mb-6 overflow-x-auto">
          <h2 className="text-lg font-heading font-bold mb-4">
            Schools
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-text-muted font-medium">School</th>
                <th className="text-left p-3 text-text-muted font-medium">Joined</th>
                <th className="text-left p-3 text-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-text-muted">
                    {new Date(s.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        s.status === "active"
                          ? "success"
                          : s.status === "pending"
                            ? "warning"
                            : "error"
                      }
                    >
                      {s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Recent Bookings */}
        <Card className="overflow-x-auto">
          <h2 className="text-lg font-heading font-bold mb-4">
            Recent Bookings
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-text-muted font-medium">Learner</th>
                <th className="text-left p-3 text-text-muted font-medium">Instructor</th>
                <th className="text-left p-3 text-text-muted font-medium">School</th>
                <th className="text-right p-3 text-text-muted font-medium">Amount</th>
                <th className="text-right p-3 text-text-muted font-medium">Your Fee</th>
                <th className="text-left p-3 text-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-border/50">
                  <td className="p-3">{b.profiles?.full_name || "—"}</td>
                  <td className="p-3">
                    {b.instructors?.profiles?.full_name || "—"}
                  </td>
                  <td className="p-3 text-text-muted">
                    {b.schools?.name || "Solo"}
                  </td>
                  <td className="p-3 text-right">£{b.price.toFixed(0)}</td>
                  <td className="p-3 text-right text-accent font-medium">
                    £{b.platform_fee.toFixed(2)}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        b.status === "completed"
                          ? "success"
                          : b.status === "confirmed"
                            ? "warning"
                            : "default"
                      }
                    >
                      {b.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PageTransition>
  );
}
