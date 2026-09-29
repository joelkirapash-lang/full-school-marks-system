import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useExams } from "@/lib/queries";
import { useMembership, logActivity } from "@/lib/auth";
import { AdminOnly } from "@/components/AdminOnly";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "Exams — Sikinter Marks System" },
      { name: "description", content: "Create and manage exam periods per term." },
      { property: "og:title", content: "Exams — Sikinter Marks System" },
      { property: "og:description", content: "Create and manage exam periods per term." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamsPage,
});

const terms = ["Term 1", "Term 2", "Term 3"];

type ExamForm = {
  id?: string;
  name: string;
  term: string;
  year: string;
  start_date: string;
  end_date: string;
  submission_deadline: string;
};

const emptyForm: ExamForm = {
  name: "",
  term: "Term 1",
  year: String(new Date().getFullYear()),
  start_date: "",
  end_date: "",
  submission_deadline: "",
};

function ExamsPage() {
  const { membership } = useMembership();
  const exams = useExams();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExamForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.name.trim()) {
      toast.error("Give the exam a name");
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      term: form.term,
      year: Number(form.year),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      submission_deadline: form.submission_deadline || null,
    };
    const { error } = form.id
      ? await supabase.from("exams").update(payload).eq("id", form.id)
      : await supabase.from("exams").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(form.id ? "Updated exam" : "Created exam", "exams", { name: payload.name });
    toast.success(form.id ? "Exam updated" : "Exam created");
    setOpen(false);
    setForm(emptyForm);
    queryClient.invalidateQueries({ queryKey: ["exams"] });
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" and all its marks?`)) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Deleted exam", "exams", { name });
    queryClient.invalidateQueries({ queryKey: ["exams"] });
  }

  if (!membership?.isAdmin) return <AdminOnly />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-document text-2xl font-bold">Exams</h1>
          <p className="text-sm text-muted-foreground">
            Name each assessment per term, e.g. “Term 1 2027 — Opener Exam”.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> New exam
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(exams.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No exams yet.
                  </TableCell>
                </TableRow>
              )}
              {exams.data?.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.name}</TableCell>
                  <TableCell>{exam.term}</TableCell>
                  <TableCell>{exam.year}</TableCell>
                  <TableCell>{exam.submission_deadline ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setForm({
                          id: exam.id,
                          name: exam.name,
                          term: exam.term,
                          year: String(exam.year),
                          start_date: exam.start_date ?? "",
                          end_date: exam.end_date ?? "",
                          submission_deadline: exam.submission_deadline ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(exam.id, exam.name)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit exam" : "New exam"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="exam-name">Exam name</Label>
              <Input
                id="exam-name"
                value={form.name}
                maxLength={120}
                placeholder="Term 1 2027 — Opener Exam"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-year">Year</Label>
                <Input
                  id="exam-year"
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exam-start">Starts</Label>
                <Input
                  id="exam-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-end">Ends</Label>
                <Input
                  id="exam-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-deadline">Marks submission deadline</Label>
              <Input
                id="exam-deadline"
                type="date"
                value={form.submission_deadline}
                onChange={(e) => setForm({ ...form, submission_deadline: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
