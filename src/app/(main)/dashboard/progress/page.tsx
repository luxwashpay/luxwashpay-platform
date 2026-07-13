"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/SkeletonLoader";
import PageTransition from "@/components/ui/PageTransition";

interface ProgressData {
  skill: string;
  mastery_level: number;
  practice_count: number;
  last_practiced_at: string | null;
}

interface LessonLog {
  id: string;
  maneuvers_covered: string[];
  notes: string;
  created_at: string;
  instructors: { profiles: { full_name: string } | null } | null;
}

const SKILLS = [
  "Parallel Parking",
  "Roundabouts",
  "Dual Carriageway",
  "Bay Parking",
  "Emergency Stop",
  "Reverse Around Corner",
  "Night Driving",
  "Motorway Driving",
];

function calculateReadinessScore(
  progress: ProgressData[],
  totalLessons: number
): number {
  const lessonScore = Math.min(totalLessons / 30, 1) * 100;
  const practicedSkills = progress.filter((p) => p.mastery_level > 0);
  const breadthScore = (practicedSkills.length / 8) * 100;
  const avgMastery =
    practicedSkills.length > 0
      ? practicedSkills.reduce((sum, p) => sum + p.mastery_level, 0) /
        practicedSkills.length
      : 0;
  const trendScore = 50;

  return Math.round(
    lessonScore * 0.25 + breadthScore * 0.3 + avgMastery * 0.3 + trendScore * 0.15
  );
}

export default function ProgressPassportPage() {
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [lessonLogs, setLessonLogs] = useState<LessonLog[]>([]);
  const [totalLessons, setTotalLessons] = useState(0);
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

      const [{ data: progressData }, { data: logs }, { count }] =
        await Promise.all([
          supabase
            .from("learner_progress")
            .select("*")
            .eq("learner_id", user.id),
          supabase
            .from("lesson_logs")
            .select(
              "*, instructors(profiles!instructors_user_id_fkey(full_name))"
            )
            .eq("learner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("learner_id", user.id)
            .eq("status", "completed"),
        ]);

      setProgress((progressData as ProgressData[]) || []);
      setLessonLogs((logs as LessonLog[]) || []);
      setTotalLessons(count || 0);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const readinessScore = calculateReadinessScore(progress, totalLessons);
  const scoreColor =
    readinessScore >= 71
      ? "#059669"
      : readinessScore >= 41
        ? "#d97706"
        : "#dc2626";

  const radarData = SKILLS.map((skill) => {
    const p = progress.find((pr) => pr.skill === skill);
    return {
      skill: skill.length > 12 ? skill.slice(0, 12) + "…" : skill,
      fullSkill: skill,
      mastery: p?.mastery_level || 0,
    };
  });

  const lowestSkills = [...radarData]
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3);

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold mb-6">
          Progress Passport
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Test Readiness Score */}
          <Card className="flex flex-col items-center py-8">
            <h2 className="text-sm font-heading font-bold text-text-muted mb-6">
              TEST READINESS SCORE
            </h2>
            <div className="relative w-40 h-40 mb-4">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="2.5"
                />
                <motion.path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0, 100" }}
                  animate={{
                    strokeDasharray: `${readinessScore}, 100`,
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <motion.span
                className="absolute inset-0 flex items-center justify-center text-4xl font-heading font-bold"
                style={{ color: scoreColor }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {readinessScore}
              </motion.span>
            </div>
            <p className="text-text-primary font-medium">
              {readinessScore >= 71
                ? "You're almost test ready!"
                : readinessScore >= 41
                  ? "Good progress — keep going!"
                  : "Just getting started — you've got this!"}
            </p>
            <p className="text-text-muted text-sm mt-1">
              {totalLessons} lessons completed
            </p>
          </Card>

          {/* Radar Chart */}
          <Card>
            <h2 className="text-sm font-heading font-bold text-text-muted mb-4">
              SKILL OVERVIEW
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  dataKey="mastery"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* What to Work On */}
        <Card className="mb-6">
          <h2 className="text-lg font-heading font-bold mb-4">
            What to Work On Next
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {lowestSkills.map((skill) => (
              <div
                key={skill.fullSkill}
                className="p-3 bg-surface rounded-lg border border-border"
              >
                <p className="text-sm font-medium">{skill.fullSkill}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${skill.mastery}%`,
                        backgroundColor:
                          skill.mastery >= 71
                            ? "#059669"
                            : skill.mastery >= 41
                              ? "#d97706"
                              : "#dc2626",
                      }}
                    />
                  </div>
                  <span className="text-text-muted text-xs w-8 text-right">
                    {skill.mastery}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Lesson Timeline */}
        <h2 className="text-lg font-heading font-bold mb-4">
          Lesson History
        </h2>
        {lessonLogs.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-text-muted text-sm">
              No lesson logs yet. After your instructor logs a lesson,
              it&apos;ll appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {lessonLogs.map((log) => (
              <Card key={log.id}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">
                      {log.instructors?.profiles?.full_name || "Instructor"}
                    </p>
                    <p className="text-text-muted text-xs">
                      {new Date(log.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {log.maneuvers_covered?.map((m) => (
                    <Badge key={m} variant="success">
                      {m}
                    </Badge>
                  ))}
                </div>
                {log.notes && (
                  <p className="text-text-muted text-sm mt-2">{log.notes}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
