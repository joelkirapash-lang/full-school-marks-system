import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Lock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMembership, logActivity } from "@/lib/auth";
import { useGradingBands, useStreams, useSubjects, useTeacherAssignments } from "@/lib/queries";
import { ClassPicker, type ClassPick } from "@/components/ClassPicker";
import { bandFor } from "@/lib/marks";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({
    meta: [
      { title: "Marks Entry — Sikinter Marks System" },
      { name: "description", content: "Enter and auto-save learner scores per subject, paste from Excel or import CSV." },
      { property: "og:title", content: "Marks Entry — Sikinter Marks System" },
      { property: "og:description", content: "Auto-saving marks entry grid for CBC learning areas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MarksEntryPage,
});

type Row = { id: string; admission_no: string; full_name: string; stream_id: string | null };
type Cell = { score: string; remarks: string; state: "idle" | "saving" | "saved" | "error" };
const BLANK: Cell = { score: "", remarks: "", state: "idle" };

function MarksEntryPage() {
  const { membership } = useMembership();
  const subjects = useSubjects();
  const bands = useGradingBands();
  const assignments = useTeacherAssignments();
  const streams = useStreams();
  const qc = useQueryClient();
  const [pick, setPick] = useState<ClassPick>({ examId: "", gradeId: "", streamId: "" });
  const [subjectId, setSubjectId] = useState("");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = !!membership?.isAdmin;
  const myAssign = (assignments.data ?? []).filter((a) => a.teacher_id === membership?.teacher?.id);

  useEffect(() => {
    if (!pick.gradeId && membership?.teacher?.home_grade_level_id)
      setPick((p) => ({ ...p, gradeId: membership.teacher!.home_grade_level_id!, streamId: membership.teacher!.home_stream_id ?? "" }));
  }, [membership, pick.gradeId]);

  const gradeSubjects = (subjects.data ?? []).filter((s) => s.grade_level_id === pick.gradeId);
  const subject = gradeSubjects.find((s) => s.id === subjectId);
  const isClassTeacher =
    !!membership?.teacher &&
    (streams.data ?? []).some(
      (s) => s.id === pick.streamId && s.grade_level_id === pick.gradeId && s.class_teacher_id === membership.teacher?.id,
    );
  const canEdit =
    isAdmin ||
    isClassTeacher ||
    myAssign.some(
      (a) => a.grade_level_id === pick.gradeId && a.subject_id === subjectId && (!a.stream_id || a.stream_id === pick.streamId),
    );

  const ready = pick.examId && pick.gradeId && pick.streamId && subjectId;
  const data = useQuery({
    queryKey: ["marks_entry", pick.examId, pick.gradeId, pick.streamId, subjectId],
    enabled: !!ready,
    queryFn: async () => {
      const [l, m] = await Promise.all([
        supabase
          .from("learners")
          .select("id, admission_no, full_name, stream_id")
          .eq("grade_level_id", pick.gradeId)
          .eq("stream_id", pick.streamId)
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("marks")
          .select("learner_id, score, remarks")
          .eq("exam_id", pick.examId)
          .eq("subject_id", subjectId)
          .eq("grade_level_id", pick.gradeId),
      ]);
      if (l.error) throw l.error;
      if (m.error) throw m.error;
      return { learners: l.data as Row[], marks: m.data };
    },
  });

  useEffect(() => {
    if (!data.data) return;
    const next: Record<string, Cell> = {};
    for (const l of data.data.learners) {
      const m = data.data.marks.find((x) => x.learner_id === l.id);
      next[l.id] = { score: m?.score == null ? "" : String(m.score), remarks: m?.remarks ?? "", state: "idle" };
    }
    setCells(next);
  }, [data.data]);

  const max = subject?.max_score ?? 100;

  async function save(learnerId: string, override?: Partial<Cell>) {
    if (!canEdit) return;
    const cell: Cell = { ...(cells[learnerId] ?? BLANK), ...override };
    const raw = cell.score.trim();
    const score = raw === "" ? null : Number(raw);
    if (score !== null && (Number.isNaN(score) || score < 0 || score > max)) {
      toast.error(`Score must be between 0 and ${max}`);
      setCells((c) => ({ ...c, [learnerId]: { ...cell, state: "error" } }));
      return;
    }
    setCells((c) => ({ ...c, [learnerId]: { ...cell, state: "saving" } }));
    const { error } = await supabase.from("marks").upsert(
      {
        learner_id: learnerId,
        exam_id: pick.examId,
        subject_id: subjectId,
        grade_level_id: pick.gradeId,
        stream_id: pick.streamId,
        score,
        remarks: cell.remarks || null,
        entered_by: membership?.userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "learner_id,exam_id,subject_id" },
    );
    setCells((c) => ({ ...c, [learnerId]: { ...(c[learnerId] ?? BLANK), state: error ? "error" : "saved" } }));
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["marks_count"] });
  }

  async function bulkApply(values: { learnerId: string; score: string }[], label: string) {
    const updates: Record<string, Cell> = { ...cells };
    values.forEach((v) => (updates[v.learnerId] = { ...(updates[v.learnerId] ?? BLANK), score: v.score }));
    setCells(updates);
    for (const v of values) await save(v.learnerId, { score: v.score });
    await logActivity(label, "marks", { count: values.length, subject: subject?.name });
    toast.success(`${values.length} scores saved`);
  }

  function onPaste(e: React.ClipboardEvent, startIndex: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).map((s) => s.split("\t")[0]?.trim() ?? "").filter((_, i, a) => i < a.length - 1 || _ !== "");
    const learners = data.data?.learners ?? [];
    const values = lines
      .map((score, i) => ({ learnerId: learners[startIndex + i]?.id, score }))
      .filter((v): v is { learnerId: string; score: string } => !!v.learnerId);
    bulkApply(values, "Pasted marks");
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const learners = data.data?.learners ?? [];
    const values: { learnerId: string; score: string }[] = [];
    for (const line of text.split(/\r?\n/)) {
      const [adm, score] = line.split(",").map((s) => s?.trim().replace(/^"|"$/g, ""));
      const l = learners.find((x) => x.admission_no.toLowerCase() === adm?.toLowerCase());
      if (l && score !== undefined) values.push({ learnerId: l.id, score });
    }
    if (!values.length) {
      toast.error("No matching admission numbers. Use columns: admission_no,score");
      return;
    }
    bulkApply(values, "Imported marks CSV");
  }

  const filled = useMemo(() => Object.values(cells).filter((c) => c.score !== "").length, [cells]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-document text-2xl font-bold">Marks entry</h1>
        <p className="text-sm text-muted-foreground">
          Scores save automatically when you leave a box. Paste a column from Excel into the first box to fill downwards.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <ClassPicker
            value={pick}
            onChange={(v) => {
              setPick(v);
              if (v.gradeId !== pick.gradeId) setSubjectId("");
            }}
            allowAllStreams={false}
          />
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {gradeSubjects.map((s) => {
                  const mine =
                    isAdmin ||
                    isClassTeacher ||
                    myAssign.some(
                      (a) =>
                        a.subject_id === s.id &&
                        a.grade_level_id === pick.gradeId &&
                        (!a.stream_id || a.stream_id === pick.streamId),
                    );
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {mine ? "" : "(view only)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!ready ? (
        <p className="text-sm text-muted-foreground">Pick an exam, grade, class and subject to start.</p>
      ) : data.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading learners…</p>
      ) : (data.data?.learners.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No learners in this class yet.</p>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {subject?.name} · out of {max} · <span className="text-primary">{filled}</span> of{" "}
                {data.data?.learners.length} entered
              </p>
              {canEdit ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-1 h-4 w-4" /> Import CSV
                  </Button>
                </>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> View only — not your assigned subject
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Adm</th>
                    <th className="p-2">Name</th>
                    <th className="p-2 w-28">Score</th>
                    <th className="p-2">Level</th>
                    <th className="p-2">Remarks</th>
                    <th className="p-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {data.data?.learners.map((l, i) => {
                    const c: Cell = cells[l.id] ?? BLANK;
                    const b = bandFor(c.score === "" ? null : Number(c.score), max, bands.data ?? []);
                    return (
                      <tr key={l.id} className="border-t border-border">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2">{l.admission_no}</td>
                        <td className="p-2">{l.full_name}</td>
                        <td className="p-1">
                          <Input
                            inputMode="decimal"
                            disabled={!canEdit}
                            value={c.score}
                            className={c.state === "error" ? "border-destructive" : ""}
                            onPaste={(e) => onPaste(e, i)}
                            onChange={(e) =>
                              setCells((s) => ({ ...s, [l.id]: { ...c, score: e.target.value, state: "idle" } }))
                            }
                            onBlur={() => c.state === "idle" && save(l.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const next = document.querySelectorAll<HTMLInputElement>("input[inputmode=decimal]")[i + 1];
                                next?.focus();
                              }
                            }}
                          />
                        </td>
                        <td className="p-2 font-semibold text-primary">{b?.level_code ?? "–"}</td>
                        <td className="p-1">
                          <Input
                            disabled={!canEdit}
                            value={c.remarks}
                            maxLength={120}
                            onChange={(e) =>
                              setCells((s) => ({ ...s, [l.id]: { ...c, remarks: e.target.value, state: "idle" } }))
                            }
                            onBlur={() => c.state === "idle" && save(l.id)}
                          />
                        </td>
                        <td className="p-2">
                          {c.state === "saving" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          {c.state === "saved" && <Check className="h-4 w-4 text-primary" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
