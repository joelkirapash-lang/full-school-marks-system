import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  useExams,
  useGradeLevels,
  useGradingBands,
  useSchoolSettings,
  useStreams,
  useSubjects,
  useTeachers,
} from "@/lib/queries";
import { ClassPicker, type ClassPick } from "@/components/ClassPicker";
import { bandFor, fmt, loadClass } from "@/lib/marks";
import { marklistExcel, marklistPdf } from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/marklists")({
  head: () => ({
    meta: [
      { title: "Marklists — Sikinter Marks System" },
      { name: "description", content: "Ranked class marklists with subject means, Excel and PDF download, and cross-class comparison." },
      { property: "og:title", content: "Marklists — Sikinter Marks System" },
      { property: "og:description", content: "Ranked marklists and subject comparison across classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MarklistsPage,
});

function MarklistsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="font-document text-2xl font-bold">Marklists</h1>
        <p className="text-sm text-muted-foreground">Ranked results per class, and subject comparison across classes.</p>
      </div>
      <Tabs defaultValue="class">
        <TabsList>
          <TabsTrigger value="class">Class marklist</TabsTrigger>
          <TabsTrigger value="compare">Compare subject</TabsTrigger>
        </TabsList>
        <TabsContent value="class" className="pt-4">
          <ClassMarklist />
        </TabsContent>
        <TabsContent value="compare" className="pt-4">
          <CompareSubject />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClassMarklist() {
  const [pick, setPick] = useState<ClassPick>({ examId: "", gradeId: "", streamId: "all" });
  const bands = useGradingBands();
  const settings = useSchoolSettings();
  const exams = useExams();
  const grades = useGradeLevels();
  const streams = useStreams();
  const teachers = useTeachers();
  const ready = !!pick.examId && !!pick.gradeId;
  const q = useQuery({
    queryKey: ["marklist", pick],
    enabled: ready,
    queryFn: () => loadClass(pick.examId, pick.gradeId, pick.streamId === "all" ? null : pick.streamId),
  });

  const exam = exams.data?.find((e) => e.id === pick.examId);
  const grade = grades.data?.find((g) => g.id === pick.gradeId);
  const stream = streams.data?.find((s) => s.id === pick.streamId);
  const classTeacher =
    pick.streamId === "all"
      ? (streams.data ?? [])
          .filter((s) => s.grade_level_id === pick.gradeId && s.class_teacher_id)
          .map((s) => `${s.name}: ${teachers.data?.find((t) => t.id === s.class_teacher_id)?.full_name ?? ""}`)
          .join(", ")
      : (teachers.data?.find((t) => t.id === stream?.class_teacher_id)?.full_name ?? "");
  const title = `${grade?.name ?? ""} ${stream?.name ?? "All classes"} — ${exam?.name ?? ""} ${exam?.term ?? ""} ${exam?.year ?? ""} Marklist`;
  const input = q.data && {
    title,
    classTeacher,
    rows: q.data.rows,
    subjects: q.data.subjects,
    subjectMeans: q.data.subjectMeans,
    bands: bands.data ?? [],
    settings: settings.data ?? null,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
          <ClassPicker value={pick} onChange={setPick} />
          <div className="flex gap-2">
            <Button variant="outline" disabled={!input} onClick={() => input && marklistExcel(input)}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button disabled={!input} onClick={() => input && marklistPdf(input)}>
              <FileDown className="mr-1 h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>
      {!ready ? (
        <p className="text-sm text-muted-foreground">Pick an exam and grade.</p>
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (
        q.data && (
          <Card className="border-primary/60">
            <CardContent className="space-y-2 p-4 font-document">
              <p className="text-center text-lg font-bold">{title}</p>
              <p className="text-sm">Class teacher: {classTeacher || "Not assigned"}</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-sidebar text-primary">
                      {["#", "Adm", "Name", ...q.data.subjects.map((s) => s.short_name || s.name), "Total", "Mean", "Lvl"].map(
                        (h, i) => (
                          <th key={i} className="border border-border p-1.5 text-left" title={q.data!.subjects[i - 3]?.name}>
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.rows.map((r) => (
                      <tr key={r.learner.id}>
                        <td className="border border-border p-1.5">{r.rank}</td>
                        <td className="border border-border p-1.5">{r.learner.admission_no}</td>
                        <td className="border border-border p-1.5 whitespace-nowrap">{r.learner.full_name}</td>
                        {q.data!.subjects.map((s) => (
                          <td key={s.id} className="border border-border p-1.5 text-center">
                            {fmt(r.scores[s.id], 0)}
                          </td>
                        ))}
                        <td className="border border-border p-1.5 font-semibold">{fmt(r.total, 0)}</td>
                        <td className="border border-border p-1.5">{fmt(r.mean)}</td>
                        <td className="border border-border p-1.5 text-primary">
                          {bandFor(r.mean, 100, bands.data ?? [])?.level_code ?? "–"}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-secondary font-semibold">
                      <td className="border border-border p-1.5" colSpan={3}>
                        Subject mean
                      </td>
                      {q.data.subjects.map((s) => (
                        <td key={s.id} className="border border-border p-1.5 text-center">
                          {fmt(q.data!.subjectMeans[s.id])}
                        </td>
                      ))}
                      <td className="border border-border p-1.5" colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
              {q.data.rows.length === 0 && <p className="text-sm text-muted-foreground">No learners in this class.</p>}
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

function CompareSubject() {
  const exams = useExams();
  const subjects = useSubjects();
  const grades = useGradeLevels();
  const streams = useStreams();
  const teachers = useTeachers();
  const bands = useGradingBands();
  const [examId, setExamId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const names = Array.from(new Set((subjects.data ?? []).map((s) => s.name))).sort();
  const matching = (subjects.data ?? []).filter((s) => s.name === subjectName);

  const q = useQuery({
    queryKey: ["compare", examId, subjectName],
    enabled: !!examId && matching.length > 0,
    queryFn: async () => {
      const [m, a] = await Promise.all([
        supabase
          .from("marks")
          .select("score, grade_level_id, stream_id, subject_id")
          .eq("exam_id", examId)
          .in("subject_id", matching.map((s) => s.id))
          .not("score", "is", null)
          .limit(20000),
        supabase.from("teacher_assignments").select("*").in("subject_id", matching.map((s) => s.id)),
      ]);
      if (m.error) throw m.error;
      return { marks: m.data, assigns: a.data ?? [] };
    },
  });

  const rows = (streams.data ?? [])
    .filter((st) => matching.some((s) => s.grade_level_id === st.grade_level_id))
    .map((st) => {
      const sub = matching.find((s) => s.grade_level_id === st.grade_level_id)!;
      const vals = (q.data?.marks ?? []).filter((m) => m.stream_id === st.id).map((m) => Number(m.score));
      const mean = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
      const teacherIds = (q.data?.assigns ?? [])
        .filter((a) => a.subject_id === sub.id && (!a.stream_id || a.stream_id === st.id))
        .map((a) => a.teacher_id);
      return {
        id: st.id,
        grade: grades.data?.find((g) => g.id === st.grade_level_id),
        stream: st.name,
        teacher: teachers.data?.filter((t) => teacherIds.includes(t.id)).map((t) => t.full_name).join(", ") || "–",
        count: vals.length,
        total: vals.reduce((x, y) => x + y, 0),
        mean,
        top: vals.length ? Math.max(...vals) : null,
        level: bandFor(mean, sub.max_score, bands.data ?? [])?.level_code ?? "–",
      };
    })
    .sort((a, b) => (a.grade?.sort_order ?? 0) - (b.grade?.sort_order ?? 0));
  const best = Math.max(...rows.map((r) => r.mean ?? -1));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label>Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select exam" />
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
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectName} onValueChange={setSubjectName}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {names.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {examId && subjectName ? (
        <Card>
          <CardContent className="overflow-x-auto p-4">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sidebar text-left text-primary">
                  {["Grade", "Class", "Subject teacher", "Entered", "Total", "Mean", "Top", "Level"].map((h) => (
                    <th key={h} className="border border-border p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.mean !== null && r.mean === best ? "bg-primary/10" : ""}>
                    <td className="border border-border p-2">{r.grade?.name}</td>
                    <td className="border border-border p-2">{r.stream}</td>
                    <td className="border border-border p-2">{r.teacher}</td>
                    <td className="border border-border p-2">{r.count}</td>
                    <td className="border border-border p-2">{fmt(r.total, 0)}</td>
                    <td className="border border-border p-2 font-semibold">{fmt(r.mean)}</td>
                    <td className="border border-border p-2">{fmt(r.top, 0)}</td>
                    <td className="border border-border p-2 text-primary">{r.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Read-only comparison. The highlighted row has the highest mean.</p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Pick an exam and a subject to compare classes side by side.</p>
      )}
    </div>
  );
}
