import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, BookPlus, Pencil } from "lucide-react";
import { EditDialog } from "@/components/EditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useStreams,
  useSubjects,
  useTeacherAssignments,
  useTeachers,
} from "@/lib/queries";
import { useMembership, logActivity } from "@/lib/auth";
import { AdminOnly } from "@/components/AdminOnly";
import { createTeacherAccount, deleteTeacherAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: "Manage Teachers — Sikinter Marks System" },
      {
        name: "description",
        content: "Create teacher logins and assign home classes and the subjects they teach.",
      },
      { property: "og:title", content: "Manage Teachers — Sikinter Marks System" },
      { property: "og:description", content: "Create teacher logins and assign classes and subjects." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeachersPage,
});

function TeachersPage() {
  const { membership } = useMembership();
  const teachers = useTeachers();
  const grades = useGradeLevels();
  const streams = useStreams();
  const subjects = useSubjects();
  const assignments = useTeacherAssignments();
  const queryClient = useQueryClient();
  const createTeacher = useServerFn(createTeacherAccount);
  const deleteTeacher = useServerFn(deleteTeacherAccount);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    homeGradeLevelId: "",
    homeStreamId: "",
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignGradeId, setAssignGradeId] = useState("");
  const [assignStreamId, setAssignStreamId] = useState("all");
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [editAssignId, setEditAssignId] = useState<string | null>(null);
  const [editT, setEditT] = useState<{
    id: string;
    full_name: string;
    phone: string;
    grade: string;
    stream: string;
    classOf: string;
  } | null>(null);

  async function addTeacher() {
    setBusy(true);
    try {
      await createTeacher({
        data: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phone: form.phone,
          homeGradeLevelId: form.homeGradeLevelId || null,
          homeStreamId: form.homeStreamId || null,
        },
      });
      await logActivity("Created teacher account", "teachers", { name: form.fullName });
      toast.success("Teacher account created");
      setOpen(false);
      setForm({ fullName: "", email: "", password: "", phone: "", homeGradeLevelId: "", homeStreamId: "" });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the teacher");
    } finally {
      setBusy(false);
    }
  }

  async function removeTeacher(id: string, name: string) {
    if (!window.confirm(`Remove ${name} and their login?`)) return;
    try {
      await deleteTeacher({ data: { teacherId: id } });
      await logActivity("Removed teacher", "teachers", { name });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teacher_assignments"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the teacher");
    }
  }

  async function addAssignment() {
    if (!assignTeacherId || !assignGradeId || !assignSubjectId) {
      toast.error("Pick a teacher, grade and subject");
      return;
    }
    const payload = {
      teacher_id: assignTeacherId,
      grade_level_id: assignGradeId,
      stream_id: assignStreamId === "all" ? null : assignStreamId,
      subject_id: assignSubjectId,
    };
    const { error } = editAssignId
      ? await supabase.from("teacher_assignments").update(payload).eq("id", editAssignId)
      : await supabase.from("teacher_assignments").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(editAssignId ? "Edited teacher assignment" : "Assigned subject to teacher", "teacher_assignments");
    toast.success(editAssignId ? "Assignment updated" : "Assignment added");
    setAssignOpen(false);
    setEditAssignId(null);
    setAssignSubjectId("");
    queryClient.invalidateQueries({ queryKey: ["teacher_assignments"] });
  }

  async function saveTeacher(values: Record<string, string>) {
    if (!editT) return;
    const { error } = await supabase
      .from("teachers")
      .update({
        full_name: (values['full_name'] ?? '').trim() || editT.full_name,
        phone: (values['phone'] ?? '').trim() || null,
        home_grade_level_id: editT.grade || null,
        home_stream_id: editT.stream || null,
      })
      .eq("id", editT.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const old = streams.data?.filter((s) => s.class_teacher_id === editT.id) ?? [];
    for (const s of old)
      if (s.id !== editT.classOf) await supabase.from("streams").update({ class_teacher_id: null }).eq("id", s.id);
    if (editT.classOf !== "none")
      await supabase.from("streams").update({ class_teacher_id: editT.id }).eq("id", editT.classOf);
    await logActivity("Edited teacher", "teachers", { name: values['full_name'] });
    toast.success("Teacher updated");
    setEditT(null);
    queryClient.invalidateQueries({ queryKey: ["teachers"] });
    queryClient.invalidateQueries({ queryKey: ["streams"] });
  }

  async function removeAssignment(id: string) {
    const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["teacher_assignments"] });
  }

  if (!membership?.isAdmin) return <AdminOnly />;

  const formStreams = streams.data?.filter((s) => s.grade_level_id === form.homeGradeLevelId) ?? [];
  const assignStreams = streams.data?.filter((s) => s.grade_level_id === assignGradeId) ?? [];
  const assignSubjects = subjects.data?.filter((s) => s.grade_level_id === assignGradeId) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-document text-2xl font-bold">Manage teachers</h1>
          <p className="text-sm text-muted-foreground">
            Create logins and decide which classes and subjects each teacher can edit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAssignTeacherId(teachers.data?.[0]?.id ?? "");
              setAssignGradeId(grades.data?.[0]?.id ?? "");
              setAssignOpen(true);
            }}
            disabled={(teachers.data?.length ?? 0) === 0}
          >
            <BookPlus className="mr-1 h-4 w-4" /> Assign subject
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add teacher
          </Button>
        </div>
      </div>

      {(teachers.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No teachers yet. Add one to create their login.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {teachers.data?.map((t) => {
            const mine = assignments.data?.filter((a) => a.teacher_id === t.id) ?? [];
            const classTeacherOf = streams.data?.filter((s) => s.class_teacher_id === t.id) ?? [];
            return (
              <Card key={t.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{t.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.email}
                        {t.phone ? ` · ${t.phone}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Home class:{" "}
                        {grades.data?.find((g) => g.id === t.home_grade_level_id)?.name ?? "not set"}
                        {t.home_stream_id
                          ? ` ${streams.data?.find((s) => s.id === t.home_stream_id)?.name ?? ""}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit"
                      onClick={() =>
                        setEditT({
                          id: t.id,
                          full_name: t.full_name,
                          phone: t.phone ?? "",
                          grade: t.home_grade_level_id ?? "",
                          stream: t.home_stream_id ?? "",
                          classOf: classTeacherOf[0]?.id ?? "none",
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeTeacher(t.id, t.full_name)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    </div>
                  </div>
                  {classTeacherOf.length > 0 && (
                    <p className="text-xs text-primary">
                      Class teacher:{" "}
                      {classTeacherOf
                        .map(
                          (s) =>
                            `${grades.data?.find((g) => g.id === s.grade_level_id)?.name ?? ""} ${s.name}`,
                        )
                        .join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {mine.length === 0 && (
                      <span className="text-xs text-muted-foreground">No subject assignments yet.</span>
                    )}
                    {mine.map((a) => (
                      <Badge key={a.id} variant="secondary" className="gap-2">
                        {grades.data?.find((g) => g.id === a.grade_level_id)?.name}
                        {a.stream_id
                          ? ` ${streams.data?.find((s) => s.id === a.stream_id)?.name ?? ""}`
                          : " (all streams)"}{" "}
                        · {subjects.data?.find((s) => s.id === a.subject_id)?.name}
                        <button
                          type="button"
                          aria-label="Edit"
                          onClick={() => {
                            setEditAssignId(a.id);
                            setAssignTeacherId(a.teacher_id);
                            setAssignGradeId(a.grade_level_id);
                            setAssignStreamId(a.stream_id ?? "all");
                            setAssignSubjectId(a.subject_id);
                            setAssignOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => removeAssignment(a.id)} aria-label="Remove">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add teacher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Full name</Label>
              <Input
                id="t-name"
                value={form.fullName}
                maxLength={120}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-email">Email (their login)</Label>
              <Input
                id="t-email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-pass">Temporary password</Label>
              <Input
                id="t-pass"
                value={form.password}
                minLength={8}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters. Share it with them.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-phone">Phone</Label>
              <Input
                id="t-phone"
                value={form.phone}
                maxLength={40}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Home grade</Label>
                <Select
                  value={form.homeGradeLevelId}
                  onValueChange={(v) => setForm({ ...form, homeGradeLevelId: v, homeStreamId: "" })}
                >
                  <SelectTrigger>
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
                <Label>Home stream</Label>
                <Select
                  value={form.homeStreamId}
                  onValueChange={(v) => setForm({ ...form, homeStreamId: v })}
                  disabled={formStreams.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formStreams.length ? "Select stream" : "No streams"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formStreams.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addTeacher} disabled={busy}>
              {busy ? "Creating…" : "Create teacher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) setEditAssignId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAssignId ? "Edit assignment" : "Assign a subject"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select
                value={assignGradeId}
                onValueChange={(v) => {
                  setAssignGradeId(v);
                  setAssignStreamId("all");
                  setAssignSubjectId("");
                }}
              >
                <SelectTrigger>
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
              <Label>Stream</Label>
              <Select value={assignStreamId} onValueChange={setAssignStreamId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All streams in this grade</SelectItem>
                  {assignStreams.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={assignSubjectId} onValueChange={setAssignSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={assignSubjects.length ? "Select subject" : "No subjects yet"} />
                </SelectTrigger>
                <SelectContent>
                  {assignSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addAssignment}>{editAssignId ? "Save changes" : "Add assignment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditDialog
        open={!!editT}
        title="Edit teacher"
        initial={{ full_name: editT?.full_name ?? "", phone: editT?.phone ?? "" }}
        fields={[
          { key: "full_name", label: "Full name" },
          { key: "phone", label: "Phone" },
        ]}
        onClose={() => setEditT(null)}
        onSave={saveTeacher}
      >
        {editT && (
          <>
            <div className="space-y-1.5">
              <Label>Home grade</Label>
              <Select value={editT.grade || "none"} onValueChange={(v) => setEditT({ ...editT, grade: v === "none" ? "" : v, stream: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {grades.data?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Home class</Label>
              <Select value={editT.stream || "none"} onValueChange={(v) => setEditT({ ...editT, stream: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {streams.data?.filter((s) => s.grade_level_id === editT.grade).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class teacher of</Label>
              <Select value={editT.classOf} onValueChange={(v) => setEditT({ ...editT, classOf: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {streams.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {grades.data?.find((g) => g.id === s.grade_level_id)?.name} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </EditDialog>
    </div>
  );
}
