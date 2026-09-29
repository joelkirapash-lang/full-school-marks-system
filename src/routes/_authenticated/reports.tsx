import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Mail, Printer, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/lib/auth";
import { sendReportCards } from "@/lib/report-email.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useExams,
  useGradeLevels,
  useGradingBands,
  useSchoolSettings,
  useStreams,
  useTeachers,
} from "@/lib/queries";
import { ClassPicker, type ClassPick } from "@/components/ClassPicker";
import { bandFor, fmt, loadClass } from "@/lib/marks";
import { reportCardsPdf } from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Report Cards — Sikinter Marks System" },
      { name: "description", content: "Learner report cards with levels, position, remarks, signatures and next term date as PDF." },
      { property: "og:title", content: "Report Cards — Sikinter Marks System" },
      { property: "og:description", content: "Download single or whole-class CBC report cards as PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [pick, setPick] = useState<ClassPick>({ examId: "", gradeId: "", streamId: "all" });
  const [learnerId, setLearnerId] = useState("");
  const [comments, setComments] = useState<Record<string, { teacher: string; head: string }>>({});
  const bands = useGradingBands();
  const settings = useSchoolSettings();
  const exams = useExams();
  const grades = useGradeLevels();
  const streams = useStreams();
  const teachers = useTeachers();
  const ready = !!pick.examId && !!pick.gradeId;
  const q = useQuery({
    queryKey: ["reports", pick],
    enabled: ready,
    queryFn: () => loadClass(pick.examId, pick.gradeId, pick.streamId === "all" ? null : pick.streamId),
  });

  const exam = exams.data?.find((e) => e.id === pick.examId);
  const grade = grades.data?.find((g) => g.id === pick.gradeId);
  const streamName = (id: string | null) => streams.data?.find((s) => s.id === id)?.name ?? "";
  const classTeacher = (id: string | null) => {
    const s = streams.data?.find((x) => x.id === id);
    return teachers.data?.find((t) => t.id === s?.class_teacher_id)?.full_name ?? "";
  };
  const row = q.data?.rows.find((r) => r.learner.id === learnerId) ?? q.data?.rows[0];
  const c = (row && comments[row.learner.id]) || { teacher: "", head: "" };
  const input = q.data && {
    examLabel: `${exam?.name ?? ""} ${exam?.term ?? ""} ${exam?.year ?? ""}`,
    gradeName: grade?.name ?? "",
    streamName,
    classTeacher,
    rows: q.data.rows,
    subjects: q.data.subjects,
    bands: bands.data ?? [],
    settings: settings.data ?? null,
    comments,
  };

  const { membership } = useMembership();
  const sendFn = useServerFn(sendReportCards);
  const [sending, setSending] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const canSend = (streamId: string | null) => {
    if (membership?.isAdmin) return true;
    const s = streams.data?.find((x) => x.id === streamId);
    return !!membership?.teacher && s?.class_teacher_id === membership.teacher.id;
  };
  const sendable = (q.data?.rows ?? []).filter((r) => canSend(r.learner.stream_id));
  const withEmail = sendable.filter((r) => r.learner.guardian_email?.trim());
  const learnerIds = (q.data?.rows ?? []).map((r) => r.learner.id);
  const sends = useQuery({
    queryKey: ["report-sends", pick.examId, learnerIds.join(",")],
    enabled: ready && learnerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("report_card_sends")
        .select("learner_id, status, error, sent_at")
        .eq("exam_id", pick.examId)
        .in("learner_id", learnerIds)
        .order("sent_at", { ascending: false });
      const latest: Record<string, { status: string; error: string | null; sent_at: string }> = {};
      for (const s of data ?? []) if (!latest[s.learner_id]) latest[s.learner_id] = s;
      return latest;
    },
  });

  async function send(ids: string[]) {
    if (!input) return;
    setSending(true);
    const counts = { sent: 0, failed: 0, no_email: 0 };
    try {
      for (let i = 0; i < ids.length; i += 5) {
        const chunk = ids.slice(i, i + 5);
        const items = chunk.map((id) => {
          const hasEmail = q.data?.rows.find((r) => r.learner.id === id)?.learner.guardian_email?.trim();
          return { learnerId: id, pdfBase64: hasEmail ? reportCardsPdf(input, [id], true) : "" };
        });
        const res = await sendFn({ data: { examId: pick.examId, examLabel: input.examLabel.trim(), items } });
        res.forEach((r) => counts[r.status]++);
      }
      if (counts.failed) toast.error(`${counts.sent} sent, ${counts.failed} failed, ${counts.no_email} with no email`);
      else toast.success(`${counts.sent} sent${counts.no_email ? `, ${counts.no_email} with no email on file` : ""}`);
    } catch (e) {
      toast.error((e as Error).message || "Could not send report cards");
    } finally {
      setSending(false);
      sends.refetch();
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-document text-2xl font-bold">Report cards</h1>
        <p className="text-sm text-muted-foreground">Preview a learner, add remarks, then download one or the whole class as PDF.</p>
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <ClassPicker value={pick} onChange={(v) => { setPick(v); setLearnerId(""); }} />
            <div className="space-y-1.5">
              <Label>Learner</Label>
              <Select value={row?.learner.id ?? ""} onValueChange={setLearnerId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select learner" />
                </SelectTrigger>
                <SelectContent>
                  {q.data?.rows.map((r) => (
                    <SelectItem key={r.learner.id} value={r.learner.id}>
                      {r.learner.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!input || !row} onClick={() => input && row && reportCardsPdf(input, [row.learner.id])}>
              <FileDown className="mr-1 h-4 w-4" /> This learner
            </Button>
            <Button disabled={!input || !q.data?.rows.length} onClick={() => input && reportCardsPdf(input)}>
              <Printer className="mr-1 h-4 w-4" /> Whole class
            </Button>
            {row && canSend(row.learner.stream_id) && (
              <Button variant="outline" disabled={sending} onClick={() => send([row.learner.id])}>
                <Mail className="mr-1 h-4 w-4" /> Send to parent
              </Button>
            )}
            {sendable.length > 0 && (
              <Button variant="secondary" disabled={sending} onClick={() => setConfirmAll(true)}>
                <Send className="mr-1 h-4 w-4" /> {sending ? "Sending…" : "Send all"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {withEmail.length} report cards now?</AlertDialogTitle>
            <AlertDialogDescription>
              Each parent receives their child's report card as a PDF.
              {sendable.length - withEmail.length > 0 &&
                ` ${sendable.length - withEmail.length} learner(s) with no email on file will be skipped.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => send(sendable.map((r) => r.learner.id))}>Send now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ready && q.data && q.data.rows.length > 0 && sendable.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold">Parent email status</p>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {q.data.rows.map((r) => {
                    const last = sends.data?.[r.learner.id];
                    const hasEmail = !!r.learner.guardian_email?.trim();
                    const label = last
                      ? last.status === "sent" ? "Sent" : last.status === "no_email" ? "No email on file" : "Failed"
                      : hasEmail ? "Not sent yet" : "No email on file";
                    const tone = last?.status === "sent" ? "text-primary" : last?.status === "failed" ? "text-destructive" : "text-muted-foreground";
                    return (
                      <tr key={r.learner.id} className="border-b border-border">
                        <td className="py-1.5 pr-2">{r.learner.full_name}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground">{r.learner.guardian_email || "—"}</td>
                        <td className={`py-1.5 pr-2 font-medium ${tone}`} title={last?.error ?? ""}>{label}</td>
                        <td className="py-1.5 text-xs text-muted-foreground">
                          {last ? new Date(last.sent_at).toLocaleString("en-GB") : ""}
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

      {!ready ? (
        <p className="text-sm text-muted-foreground">Pick an exam and grade.</p>
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !row ? (
        <p className="text-sm text-muted-foreground">No learners in this class.</p>
      ) : (
        <Card className="border-2 border-primary">
          <CardContent className="space-y-4 p-6 font-document">
            <div className="flex items-center gap-4 border-b border-primary pb-3">
              {settings.data?.logo_url && <img src={settings.data.logo_url} alt="School logo" className="h-16 w-16 object-contain" />}
              <div className="flex-1 text-center">
                <p className="text-xl font-bold">{settings.data?.school_name}</p>
                {settings.data?.motto && <p className="text-xs italic text-muted-foreground">{settings.data.motto}</p>}
                <p className="mt-1 text-sm font-semibold">Report card — {input?.examLabel}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <p>Name: <b>{row.learner.full_name}</b></p>
              <p>Adm No: {row.learner.admission_no}</p>
              <p>Grade: {grade?.name} {streamName(row.learner.stream_id)}</p>
              <p>Position: {row.rank} out of {q.data!.rows.length}</p>
              <p>Class teacher: {classTeacher(row.learner.stream_id) || "–"}</p>
              <p>UPI: {row.learner.upi_number || "–"}</p>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sidebar text-left text-primary">
                  {["Learning area", "Score", "Out of", "Level", "Remarks"].map((h) => (
                    <th key={h} className="border border-border p-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data!.subjects.map((s) => {
                  const b = bandFor(row.scores[s.id], s.max_score, bands.data ?? []);
                  return (
                    <tr key={s.id}>
                      <td className="border border-border p-2">{s.name}</td>
                      <td className="border border-border p-2">{fmt(row.scores[s.id], 0)}</td>
                      <td className="border border-border p-2">{s.max_score}</td>
                      <td className="border border-border p-2">{b ? `${b.level_code} ${b.label}` : "–"}</td>
                      <td className="border border-border p-2">{row.remarks[s.id]}</td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary font-semibold">
                  <td className="border border-border p-2">Total / Mean</td>
                  <td className="border border-border p-2">{fmt(row.total, 0)}</td>
                  <td className="border border-border p-2" />
                  <td className="border border-border p-2">{bandFor(row.mean, 100, bands.data ?? [])?.level_code ?? "–"}</td>
                  <td className="border border-border p-2">Mean: {fmt(row.mean)}</td>
                </tr>
              </tbody>
            </table>
            {(["teacher", "head"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label>{k === "teacher" ? "Class teacher's remarks" : "Head teacher's remarks"}</Label>
                <Textarea
                  value={c[k]}
                  maxLength={300}
                  onChange={(e) =>
                    setComments((all) => ({ ...all, [row.learner.id]: { ...c, [k]: e.target.value } }))
                  }
                />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-3">
              {["Class teacher signature", "Head teacher signature", "School stamp"].map((l) => (
                <div key={l} className="flex h-20 items-end rounded border border-border p-2 text-xs text-muted-foreground">{l}</div>
              ))}
            </div>
            <p className="text-sm font-semibold">
              Next term begins:{" "}
              {settings.data?.next_term_begins
                ? new Date(settings.data.next_term_begins).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "To be announced"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
