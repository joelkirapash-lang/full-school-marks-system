import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useExams, useGradeLevels, useGradingBands, useLearners, useStreams, useTeachers } from "@/lib/queries";
import { bandFor, fmt, loadClass, type Learner } from "@/lib/marks";

export function GlobalSearch() {
  const learners = useLearners();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [selected, setSelected] = useState<Learner | null>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 1) return [];
    return (learners.data ?? [])
      .filter(
        (l) =>
          l.full_name.toLowerCase().includes(t) ||
          l.admission_no.toLowerCase().includes(t) ||
          (l.upi_number ?? "").toLowerCase().includes(t),
      )
      .slice(0, 8);
  }, [q, learners.data]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder="Search learner by name, admission or UPI…"
        className="pl-8"
      />
      {focus && q.trim() && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No learners found</p>
          ) : (
            results.map((l) => (
              <button
                key={l.id}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelected(l);
                  setFocus(false);
                  setQ("");
                }}
              >
                <span className="truncate text-popover-foreground">{l.full_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {l.admission_no}
                  {l.upi_number ? ` · ${l.upi_number}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <LearnerProfile learner={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LearnerProfile({ learner }: { learner: Learner }) {
  const exams = useExams();
  const grades = useGradeLevels();
  const streams = useStreams();
  const teachers = useTeachers();
  const bands = useGradingBands();
  const [examId, setExamId] = useState("");
  const exam = examId || exams.data?.[0]?.id || "";
  const grade = grades.data?.find((g) => g.id === learner.grade_level_id);
  const stream = streams.data?.find((s) => s.id === learner.stream_id);
  const classTeacher = teachers.data?.find((t) => t.id === stream?.class_teacher_id);

  const cls = useQuery({
    queryKey: ["profile_class", exam, learner.grade_level_id, learner.stream_id],
    enabled: !!exam && !!learner.grade_level_id,
    queryFn: () => loadClass(exam, learner.grade_level_id!, learner.stream_id),
  });

  const history = useQuery({
    queryKey: ["profile_history", learner.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("marks").select("exam_id, score").eq("learner_id", learner.id);
      if (error) throw error;
      return data;
    },
  });

  const row = cls.data?.rows.find((r) => r.learner.id === learner.id);
  const meanPct = useMemo(() => {
    if (!row || !cls.data) return null;
    const pcts = cls.data.subjects
      .filter((s) => row.scores[s.id] != null)
      .map((s) => ((row.scores[s.id] as number) / (s.max_score || 100)) * 100);
    return pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  }, [row, cls.data]);
  const level = meanPct == null ? null : bandFor(meanPct, 100, bands.data ?? []);

  const chart = useMemo(() => {
    const list = [...(exams.data ?? [])].reverse();
    return list
      .map((e) => {
        const ms = (history.data ?? []).filter((m) => m.exam_id === e.id && m.score != null);
        if (!ms.length) return null;
        const total = ms.reduce((a, m) => a + Number(m.score), 0);
        return { name: e.name, average: Number((total / ms.length).toFixed(1)) };
      })
      .filter((x): x is { name: string; average: number } => !!x);
  }, [exams.data, history.data]);

  const info: [string, string | null | undefined][] = [
    ["Admission no.", learner.admission_no],
    ["UPI number", learner.upi_number],
    ["Assessment no.", learner.assessment_no],
    ["Grade", grade?.name],
    ["Stream", stream?.name],
    ["Class teacher", classTeacher?.full_name],
    ["Guardian", learner.guardian_name],
    ["Guardian phone", learner.guardian_phone],
    ["Guardian email", learner.guardian_email],
  ];

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="font-document">{learner.full_name}</SheetTitle>
      </SheetHeader>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {info.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v || "–"}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-1.5">
        <Label>Exam</Label>
        <Select value={exam} onValueChange={setExamId}>
          <SelectTrigger>
            <SelectValue placeholder="No exams yet" />
          </SelectTrigger>
          <SelectContent>
            {exams.data?.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} · {e.term} {e.year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cls.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading marks…</p>
      ) : cls.data && row ? (
        <>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-2">Subject</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Level</th>
                </tr>
              </thead>
              <tbody>
                {cls.data.subjects.map((s) => {
                  const sc = row.scores[s.id];
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="p-2">{s.name}</td>
                      <td className="p-2">{sc == null ? "–" : `${fmt(sc)} / ${s.max_score}`}</td>
                      <td className="p-2 font-semibold text-primary">
                        {bandFor(sc, s.max_score, bands.data ?? [])?.level_code ?? "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["Total", fmt(row.total)],
              ["Average", fmt(row.mean)],
              ["Position", row.count ? `${row.rank} / ${cls.data.rows.length}` : "–"],
              ["Level", level?.level_code ?? "–"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="font-semibold text-foreground">{v}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No marks for this exam.</p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Average across exams</p>
        {chart.length < 1 ? (
          <p className="text-sm text-muted-foreground">No results yet.</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="average" stroke="var(--primary)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
