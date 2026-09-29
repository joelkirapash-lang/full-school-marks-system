import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search, Upload } from "lucide-react";
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
import { useGradeLevels, useLearners, useStreams } from "@/lib/queries";
import { fileToCompressedDataUrl } from "@/lib/image";
import { useMembership, logActivity } from "@/lib/auth";
import { AdminOnly } from "@/components/AdminOnly";

export const Route = createFileRoute("/_authenticated/learners")({
  head: () => ({
    meta: [
      { title: "Manage Learners — Sikinter Marks System" },
      {
        name: "description",
        content: "Add, edit and organise learners by admission number, grade, stream and guardian contact.",
      },
      { property: "og:title", content: "Manage Learners — Sikinter Marks System" },
      { property: "og:description", content: "Add, edit and organise learners by grade and stream." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LearnersPage,
});

type LearnerForm = {
  id?: string;
  admission_no: string;
  upi_number: string;
  full_name: string;
  gender: string;
  grade_level_id: string;
  stream_id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  photo_url: string;
};

const emptyLearner: LearnerForm = {
  admission_no: "",
  upi_number: "",
  full_name: "",
  gender: "",
  grade_level_id: "",
  stream_id: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  photo_url: "",
};

function LearnersPage() {
  const { membership } = useMembership();
  const learners = useLearners();
  const grades = useGradeLevels();
  const streams = useStreams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LearnerForm>(emptyLearner);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (learners.data ?? []).filter((l) => {
      const matchesGrade = gradeFilter === "all" || l.grade_level_id === gradeFilter;
      const matchesTerm =
        !term ||
        l.full_name.toLowerCase().includes(term) ||
        l.admission_no.toLowerCase().includes(term);
      return matchesGrade && matchesTerm;
    });
  }, [learners.data, search, gradeFilter]);

  const formStreams = streams.data?.filter((s) => s.grade_level_id === form.grade_level_id) ?? [];

  async function uploadPhoto(file: File) {
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 320);
      setForm((f) => ({ ...f, photo_url: dataUrl }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form.full_name.trim() || !form.admission_no.trim()) {
      toast.error("Admission number and full name are required");
      return;
    }
    setBusy(true);
    const payload = {
      admission_no: form.admission_no.trim(),
      upi_number: form.upi_number.trim() || null,
      full_name: form.full_name.trim(),
      gender: form.gender || null,
      grade_level_id: form.grade_level_id || null,
      stream_id: form.stream_id || null,
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      guardian_email: form.guardian_email.trim() || null,
      photo_url: form.photo_url || null,
    };
    const { error } = form.id
      ? await supabase.from("learners").update(payload).eq("id", form.id)
      : await supabase.from("learners").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(form.id ? "Updated learner" : "Added learner", "learners", {
      name: payload.full_name,
    });
    toast.success(form.id ? "Learner updated" : "Learner added");
    setOpen(false);
    setForm(emptyLearner);
    queryClient.invalidateQueries({ queryKey: ["learners"] });
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? All their marks will be removed.`)) return;
    const { error } = await supabase.from("learners").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Deleted learner", "learners", { name });
    queryClient.invalidateQueries({ queryKey: ["learners"] });
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      toast.error("The file looks empty");
      return;
    }
    const headers = (lines[0] ?? "").split(",").map((h) => h.trim().toLowerCase());
    const pick = (cols: string[], column: string, fallbackIndex?: number) => {
      const i = headers.indexOf(column);
      const value = i >= 0 ? cols[i] : fallbackIndex !== undefined ? cols[fallbackIndex] : undefined;
      return (value ?? "").trim();
    };
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const gradeName = pick(cols, "grade");
      const streamName = pick(cols, "stream");
      const grade = grades.data?.find((g) => g.name.toLowerCase() === gradeName.toLowerCase());
      const stream = streams.data?.find(
        (s) => s.grade_level_id === grade?.id && s.name.toLowerCase() === streamName.toLowerCase(),
      );
      return {
        admission_no: pick(cols, "admission_no", 0),
        full_name: pick(cols, "full_name", 1),
        upi_number: pick(cols, "upi_number") || null,
        guardian_name: pick(cols, "guardian_name") || null,
        guardian_phone: pick(cols, "guardian_phone") || null,
        guardian_email:
          ["parent email", "parent_email", "guardian email", "guardian_email"]
            .map((h) => pick(cols, h))
            .find(Boolean) || null,
        grade_level_id: grade?.id ?? null,
        stream_id: stream?.id ?? null,
      };
    });
    const valid = rows.filter((r) => r.admission_no !== "" && r.full_name !== "");
    if (valid.length === 0) {
      toast.error("No usable rows found. Use columns: admission_no, full_name, grade, stream");
      return;
    }
    const { error } = await supabase.from("learners").upsert(valid, { onConflict: "admission_no" });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Imported learners", "learners", { count: valid.length });
    toast.success(`${valid.length} learners imported`);
    queryClient.invalidateQueries({ queryKey: ["learners"] });
  }

  if (!membership?.isAdmin) return <AdminOnly />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-document text-2xl font-bold">Manage learners</h1>
          <p className="text-sm text-muted-foreground">{learners.data?.length ?? 0} learners on record</p>
        </div>
        <div className="flex gap-2">
          <Label htmlFor="csv" className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" /> Import CSV
            </span>
          </Label>
          <Input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCsv(file);
            }}
          />
          <Button
            onClick={() => {
              setForm(emptyLearner);
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add learner
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or admission number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {grades.data?.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adm. No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No learners found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.admission_no}</TableCell>
                  <TableCell className="font-medium">{l.full_name}</TableCell>
                  <TableCell>{grades.data?.find((g) => g.id === l.grade_level_id)?.name ?? "—"}</TableCell>
                  <TableCell>{streams.data?.find((s) => s.id === l.stream_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.guardian_name ? `${l.guardian_name} · ${l.guardian_phone ?? ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setForm({
                          id: l.id,
                          admission_no: l.admission_no,
                          upi_number: l.upi_number ?? "",
                          full_name: l.full_name,
                          gender: l.gender ?? "",
                          grade_level_id: l.grade_level_id ?? "",
                          stream_id: l.stream_id ?? "",
                          guardian_name: l.guardian_name ?? "",
                          guardian_phone: l.guardian_phone ?? "",
                          guardian_email: l.guardian_email ?? "",
                          photo_url: l.photo_url ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(l.id, l.full_name)}>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit learner" : "Add learner"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="adm">Admission number</Label>
              <Input
                id="adm"
                value={form.admission_no}
                maxLength={40}
                onChange={(e) => setForm({ ...form, admission_no: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upi">UPI number</Label>
              <Input
                id="upi"
                value={form.upi_number}
                maxLength={40}
                onChange={(e) => setForm({ ...form, upi_number: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={form.full_name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select
                value={form.grade_level_id}
                onValueChange={(v) => setForm({ ...form, grade_level_id: v, stream_id: "" })}
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
              <Select
                value={form.stream_id}
                onValueChange={(v) => setForm({ ...form, stream_id: v })}
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
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardian">Guardian name</Label>
              <Input
                id="guardian"
                value={form.guardian_name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gphone">Guardian phone</Label>
              <Input
                id="gphone"
                value={form.guardian_phone}
                maxLength={40}
                onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gemail">Parent email (optional)</Label>
              <Input
                id="gemail"
                type="email"
                value={form.guardian_email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="photo">Photo</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhoto(file);
                }}
              />
              {form.photo_url && (
                <img
                  src={form.photo_url}
                  alt="Learner"
                  className="mt-2 h-16 w-16 rounded-md object-cover"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save learner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
