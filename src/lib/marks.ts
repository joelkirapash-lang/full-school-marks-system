import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Learner = Tables<"learners">;
export type Subject = Tables<"subjects">;
export type Mark = Tables<"marks">;
export type Band = Tables<"grading_bands">;

export function bandFor(score: number | null | undefined, max: number, bands: Band[]) {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  const pct = max > 0 ? (score / max) * 100 : score;
  return (
    bands.find((b) => pct >= Number(b.min_score) && pct <= Number(b.max_score)) ??
    bands.find((b) => Math.round(pct) >= Number(b.min_score) && Math.round(pct) <= Number(b.max_score)) ??
    null
  );
}

export function subjectLabel(s: Subject, short = true) {
  return short ? s.short_name || s.name : s.name;
}

export type ClassRow = {
  learner: Learner;
  scores: Record<string, number | null>;
  remarks: Record<string, string | null>;
  total: number;
  count: number;
  mean: number;
  rank: number;
};

/** Loads learners, subjects and marks for one exam and grade (optionally one stream) and ranks learners by total. */
export async function loadClass(examId: string, gradeId: string, streamId: string | null) {
  let lq = supabase
    .from("learners")
    .select("*")
    .eq("grade_level_id", gradeId)
    .eq("is_active", true)
    .order("full_name");
  if (streamId) lq = lq.eq("stream_id", streamId);
  let mq = supabase.from("marks").select("*").eq("exam_id", examId).eq("grade_level_id", gradeId).limit(10000);
  if (streamId) mq = mq.eq("stream_id", streamId);
  const [lr, sr, mr] = await Promise.all([
    lq,
    supabase.from("subjects").select("*").eq("grade_level_id", gradeId).order("sort_order").order("name"),
    mq,
  ]);
  if (lr.error) throw lr.error;
  if (sr.error) throw sr.error;
  if (mr.error) throw mr.error;
  const learners = lr.data;
  const subjects = sr.data;
  const marks = mr.data;
  const rows: ClassRow[] = learners.map((learner) => {
    const scores: Record<string, number | null> = {};
    const remarks: Record<string, string | null> = {};
    let total = 0;
    let count = 0;
    for (const m of marks) {
      if (m.learner_id !== learner.id) continue;
      scores[m.subject_id] = m.score === null ? null : Number(m.score);
      remarks[m.subject_id] = m.remarks;
      if (m.score !== null) {
        total += Number(m.score);
        count++;
      }
    }
    return { learner, scores, remarks, total, count, mean: count ? total / count : 0, rank: 0 };
  });
  rows.sort((a, b) => b.total - a.total || a.learner.full_name.localeCompare(b.learner.full_name));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.total === r.total ? prev.rank : i + 1;
  });
  const subjectMeans: Record<string, number | null> = {};
  for (const s of subjects) {
    const vals = rows.map((r) => r.scores[s.id]).filter((v): v is number => v !== null && v !== undefined);
    subjectMeans[s.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return { learners, subjects, marks, rows, subjectMeans };
}

export const fmt = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? "–" : Number(n).toFixed(d).replace(/\.0$/, "");
