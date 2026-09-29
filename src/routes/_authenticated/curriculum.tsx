import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { EditDialog } from "@/components/EditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  useGradeLevels,
  useGradingBands,
  useStreams,
  useSubjects,
  useTeacherAssignments,
  useTeachers,
} from "@/lib/queries";
import { useMembership, logActivity } from "@/lib/auth";
import { AdminOnly } from "@/components/AdminOnly";

export const Route = createFileRoute("/_authenticated/curriculum")({
  head: () => ({
    meta: [
      { title: "Grades & Subjects — Sikinter Marks System" },
      {
        name: "description",
        content: "Manage grade levels, streams, subject lists, class teachers and CBC score bands.",
      },
      { property: "og:title", content: "Grades & Subjects — Sikinter Marks System" },
      {
        property: "og:description",
        content: "Manage grade levels, streams, subjects, class teachers and score bands.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CurriculumPage,
});

const defaultGrades = [
  "Playgroup",
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

function CurriculumPage() {
  const { membership } = useMembership();
  const grades = useGradeLevels();
  const streams = useStreams();
  const subjects = useSubjects();
  const bands = useGradingBands();
  const teachers = useTeachers();
  const assignments = useTeacherAssignments();
  const queryClient = useQueryClient();

  const [newGrade, setNewGrade] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [newStream, setNewStream] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [subjectMax, setSubjectMax] = useState("100");
  const [newShort, setNewShort] = useState("");
  const [editing, setEditing] = useState<
    | { kind: "grade" | "stream" | "subject"; id: string; values: Record<string, string> }
    | null
  >(null);

  const activeGradeId = selectedGradeId || grades.data?.[0]?.id || "";
  const gradeStreams = streams.data?.filter((s) => s.grade_level_id === activeGradeId) ?? [];
  const gradeSubjects = subjects.data?.filter((s) => s.grade_level_id === activeGradeId) ?? [];

  function refresh(...keys: string[]) {
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  }

  async function addGrade(name: string, sortOrder?: number) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("grade_levels")
      .insert({ name: trimmed, sort_order: sortOrder ?? (grades.data?.length ?? 0) + 1 });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Added grade level", "grade_levels", { name: trimmed });
    setNewGrade("");
    refresh("grade_levels");
  }

  async function addAllDefaultGrades() {
    const existing = new Set(grades.data?.map((g) => g.name));
    const rows = defaultGrades
      .filter((name) => !existing.has(name))
      .map((name, i) => ({ name, sort_order: defaultGrades.indexOf(name) + 1 + i * 0 }));
    if (rows.length === 0) {
      toast.info("All standard grades already exist");
      return;
    }
    const { error } = await supabase.from("grade_levels").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Added standard grade levels", "grade_levels", { count: rows.length });
    toast.success(`${rows.length} grade levels added`);
    refresh("grade_levels");
  }

  async function removeGrade(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? Its streams, subjects and marks will be removed.`)) return;
    const { error } = await supabase.from("grade_levels").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Deleted grade level", "grade_levels", { name });
    refresh("grade_levels", "streams", "subjects");
  }

  async function addStream() {
    if (!activeGradeId || !newStream.trim()) return;
    const { error } = await supabase
      .from("streams")
      .insert({ grade_level_id: activeGradeId, name: newStream.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Added stream", "streams", { name: newStream.trim() });
    setNewStream("");
    refresh("streams");
  }

  async function setClassTeacher(streamId: string, teacherId: string) {
    const { error } = await supabase
      .from("streams")
      .update({ class_teacher_id: teacherId === "none" ? null : teacherId })
      .eq("id", streamId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Assigned class teacher", "streams", { streamId });
    toast.success("Class teacher saved");
    refresh("streams");
  }

  async function removeStream(id: string, name: string) {
    if (!window.confirm(`Delete stream ${name}?`)) return;
    const { error } = await supabase.from("streams").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh("streams");
  }

  async function addSubject() {
    if (!activeGradeId || !newSubject.trim()) return;
    const { error } = await supabase.from("subjects").insert({
      grade_level_id: activeGradeId,
      name: newSubject.trim(),
      short_name: newShort.trim() || null,
      max_score: Number(subjectMax) || 100,
      sort_order: gradeSubjects.length + 1,
    });
    setNewShort("");
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Added subject", "subjects", { name: newSubject.trim() });
    setNewSubject("");
    refresh("subjects");
  }

  async function removeSubject(id: string, name: string) {
    if (!window.confirm(`Delete subject ${name}? Its marks will be removed.`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh("subjects");
  }

  async function saveBand(id: string, min: number, max: number, label: string) {
    const { error } = await supabase
      .from("grading_bands")
      .update({ min_score: min, max_score: max, label })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Band saved");
    refresh("grading_bands");
  }

  async function saveEdit(values: Record<string, string>) {
    if (!editing) return;
    const name = values['name']?.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const res =
      editing.kind === "grade"
        ? await supabase.from("grade_levels").update({ name }).eq("id", editing.id)
        : editing.kind === "stream"
          ? await supabase.from("streams").update({ name }).eq("id", editing.id)
          : await supabase
              .from("subjects")
              .update({
                name,
                short_name: values['short_name']?.trim() || null,
                max_score: Number(values['max_score']) || 100,
              })
              .eq("id", editing.id);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    await logActivity(`Edited ${editing.kind}`, editing.kind, { name });
    toast.success("Saved");
    setEditing(null);
    refresh("grade_levels", "streams", "subjects");
  }

  if (!membership?.isAdmin) return <AdminOnly />;

  const teachersForGrade = (teachers.data ?? []).filter(
    (t) =>
      t.home_grade_level_id === activeGradeId ||
      (assignments.data ?? []).some(
        (a) => a.teacher_id === t.id && a.grade_level_id === activeGradeId,
      ),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-document text-2xl font-bold">Grades & subjects</h1>
        <p className="text-sm text-muted-foreground">
          Build your grade levels, streams, subject lists and CBC score bands.
        </p>
      </div>

      <Tabs defaultValue="grades">
        <TabsList>
          <TabsTrigger value="grades">Grades & streams</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="bands">Score bands</TabsTrigger>
        </TabsList>

        <TabsContent value="grades" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grade levels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="e.g. Grade 4"
                  value={newGrade}
                  maxLength={40}
                  onChange={(e) => setNewGrade(e.target.value)}
                />
                <Button onClick={() => addGrade(newGrade)}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
                {(grades.data?.length ?? 0) === 0 && (
                  <Button variant="outline" onClick={addAllDefaultGrades}>
                    Add Playgroup–Grade 10
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {grades.data?.map((g) => (
                  <span
                    key={g.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                      g.id === activeGradeId ? "border-primary text-primary" : "border-border"
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedGradeId(g.id)}>
                      {g.name}
                    </button>
                    <button
                      type="button"
                      aria-label="Edit"
                      onClick={() => setEditing({ kind: "grade", id: g.id, values: { name: g.name } })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeGrade(g.id, g.name)} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {activeGradeId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Streams in {grades.data?.find((g) => g.id === activeGradeId)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    className="max-w-xs"
                    placeholder="e.g. East"
                    value={newStream}
                    maxLength={40}
                    onChange={(e) => setNewStream(e.target.value)}
                  />
                  <Button onClick={addStream}>
                    <Plus className="mr-1 h-4 w-4" /> Add stream
                  </Button>
                </div>
                {gradeStreams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No streams yet for this grade.</p>
                ) : (
                  <div className="space-y-2">
                    {gradeStreams.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm font-medium">{s.name}</span>
                        <div className="ml-auto flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Class teacher</Label>
                          <Select
                            value={s.class_teacher_id ?? "none"}
                            onValueChange={(v) => setClassTeacher(s.id, v)}
                          >
                            <SelectTrigger className="w-52">
                              <SelectValue placeholder="Not assigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not assigned</SelectItem>
                              {teachersForGrade.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit"
                            onClick={() => setEditing({ kind: "stream", id: s.id, values: { name: s.name } })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeStream(s.id, s.name)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {teachersForGrade.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Only teachers assigned to this grade appear in the class-teacher list.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subjects per grade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label>Grade</Label>
                  <Select value={activeGradeId} onValueChange={setSelectedGradeId}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.data?.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Learning area</Label>
                  <Input
                    className="w-56"
                    placeholder="e.g. Mathematics"
                    value={newSubject}
                    maxLength={80}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Short name</Label>
                  <Input
                    className="w-28"
                    placeholder="e.g. MAT"
                    value={newShort}
                    maxLength={12}
                    onChange={(e) => setNewShort(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Max score</Label>
                  <Input
                    className="w-24"
                    type="number"
                    value={subjectMax}
                    onChange={(e) => setSubjectMax(e.target.value)}
                  />
                </div>
                <Button onClick={addSubject} disabled={!activeGradeId}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              {gradeSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subjects for this grade yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {gradeSubjects.map((s) => (
                    <span
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      {s.name}
                      <span className="text-xs text-primary">{s.short_name}</span>
                      <span className="text-xs text-muted-foreground">/{s.max_score}</span>
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() =>
                          setEditing({
                            kind: "subject",
                            id: s.id,
                            values: { name: s.name, short_name: s.short_name ?? "", max_score: String(s.max_score) },
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => removeSubject(s.id, s.name)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bands" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CBC performance bands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bands.data?.map((band) => (
                <BandRow key={band.id} band={band} onSave={saveBand} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <EditDialog
        open={!!editing}
        title={`Edit ${editing?.kind ?? ""}`}
        initial={editing?.values ?? {}}
        fields={
          editing?.kind === "subject"
            ? [
                { key: "name", label: "Full name (report cards)" },
                { key: "short_name", label: "Short name (marklists)" },
                { key: "max_score", label: "Max score", type: "number" },
              ]
            : [{ key: "name", label: "Name" }]
        }
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />
    </div>
  );
}

function BandRow({
  band,
  onSave,
}: {
  band: { id: string; level_code: string; label: string; min_score: number; max_score: number };
  onSave: (id: string, min: number, max: number, label: string) => Promise<void>;
}) {
  const [min, setMin] = useState(String(band.min_score));
  const [max, setMax] = useState(String(band.max_score));
  const [label, setLabel] = useState(band.label);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
      <span className="w-14 font-semibold text-primary">{band.level_code}</span>
      <Input className="w-56" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
      <Input className="w-20" type="number" value={min} onChange={(e) => setMin(e.target.value)} />
      <span className="text-muted-foreground">to</span>
      <Input className="w-20" type="number" value={max} onChange={(e) => setMax(e.target.value)} />
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        onClick={() => onSave(band.id, Number(min), Number(max), label)}
      >
        Save
      </Button>
    </div>
  );
}
