import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/lib/auth";
import { useExams, useGradeLevels, useGradingBands, useLearners, useStreams, useSubjects } from "@/lib/queries";
import { bandFor, fmt } from "@/lib/marks";

function Delta({ v, suffix = "" }: { v: number | null; suffix?: string }) {
  if (v === null) return <span className="text-muted-foreground">–</span>;
  const Icon = v > 0.05 ? ArrowUp : v < -0.05 ? ArrowDown : Minus;
  const cls = v > 0.05 ? "text-success" : v < -0.05 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {v > 0 ? "+" : ""}
      {fmt(v)}
      {suffix}
    </span>
  );
}

type M = { learner_id: string; subject_id: string; score: number | null; grade_level_id: string; stream_id: string | null };

export function ExamComparison() {
  const { membership } = useMembership();
  const exams = useExams();
  const learners = useLearners();
  const subjects = useSubjects();
  const grades = useGradeLevels();
  const streams = useStreams();
  const bands = useGradingBands();
  const [examSel, setExamSel] = useState("");
  const [prevSel, setPrevSel] = useState("");
  const [allClasses, setAllClasses] = useState(false);

  const list = exams.data ?? [];
  const cur = examSel || list[0]?.id || "";
  const prev = prevSel || list.find((e) => e.id !== cur && list.indexOf(e) > list.findIndex((x) => x.id === cur))?.id || "";
  const isAdmin = !!membership?.isAdmin;
  const homeGrade = membership?.teacher?.home_grade_level_id ?? null;
  const homeStream = membership?.teacher?.home_stream_id ?? null;
  const scoped = !isAdmin && !allClasses && !!homeGrade;

  const marks = useQuery({
    queryKey: ["compare", cur, prev],
    enabled: !!cur,
    queryFn: async () => {
      const ids = [cur, prev].filter(Boolean);
      const { data, error } = await supabase
        .from("marks")
        .select("exam_id, learner_id, subject_id, score, grade_level_id, stream_id")
        .in("exam_id", ids)
        .limit(50000);
      if (error) throw error;
      return data;
    },
  });

  const a = useMemo(() => {
    if (!marks.data) return null;
    const subjMax = new Map((subjects.data ?? []).map((s) => [s.id, s.max_score || 100]));
    const subjName = new Map((subjects.data ?? []).map((s) => [s.id, s.short_name || s.name]));
    const inScope = (m: M) => !scoped || (m.grade_level_id === homeGrade && (!homeStream || m.stream_id === homeStream));
    const pct = (m: M) => (Number(m.score) / (subjMax.get(m.subject_id) ?? 100)) * 100;
    const build = (examId: string) => {
      const ms = marks.data.filter((m) => m.exam_id === examId && m.score !== null && inScope(m)) as M[];
      const byLearner = new Map<string, number[]>();
      const bySubject = new Map<string, number[]>();
      const byClass = new Map<string, number[]>();
      for (const m of ms) {
        const p = pct(m);
        byLearner.set(m.learner_id, [...(byLearner.get(m.learner_id) ?? []), p]);
        const sn = subjName.get(m.subject_id) ?? "?";
        bySubject.set(sn, [...(bySubject.get(sn) ?? []), p]);
      }
      const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
      const learnerAvg = new Map([...byLearner].map(([k, v]) => [k, avg(v)]));
      for (const m of ms) {
        const key = `${m.grade_level_id}|${m.stream_id ?? ""}`;
        if (!byClass.has(key)) byClass.set(key, []);
      }
      for (const [lid, v] of learnerAvg) {
        const m = ms.find((x) => x.learner_id === lid)!;
        byClass.get(`${m.grade_level_id}|${m.stream_id ?? ""}`)!.push(v);
      }
      const vals = [...learnerAvg.values()];
      return {
        mean: vals.length ? avg(vals) : null,
        learners: learnerAvg,
        subjects: new Map([...bySubject].map(([k, v]) => [k, avg(v)])),
        classes: new Map([...byClass].map(([k, v]) => [k, avg(v)])),
      };
    };
    const now = build(cur);
    const before = prev ? build(prev) : null;
    const subjectData = [...new Set([...now.subjects.keys(), ...(before?.subjects.keys() ?? [])])].map((s) => ({
      subject: s,
      Current: Number(fmt(now.subjects.get(s) ?? null)) || 0,
      Previous: Number(fmt(before?.subjects.get(s) ?? null)) || 0,
    }));
    const changes = before
      ? [...now.learners]
          .filter(([id]) => before.learners.has(id))
          .map(([id, v]) => ({ id, change: v - before.learners.get(id)! }))
      : [];
    const sorted = [...changes].sort((x, y) => y.change - x.change);
    const order = new Map((bands.data ?? []).map((b) => [b.id, b.sort_order]));
    const move = { up: 0, same: 0, down: 0 };
    if (before)
      for (const [id, v] of now.learners) {
        const b0 = before.learners.get(id);
        if (b0 === undefined) continue;
        const o1 = order.get(bandFor(v, 100, bands.data ?? [])?.id ?? "") ?? 0;
        const o0 = order.get(bandFor(b0, 100, bands.data ?? [])?.id ?? "") ?? 0;
        if (o1 > o0) move.up++;
        else if (o1 < o0) move.down++;
        else move.same++;
      }
    const classes = [...now.classes].map(([k, v]) => {
      const [g, s] = k.split("|");
      const name = `${grades.data?.find((x) => x.id === g)?.name ?? ""} ${streams.data?.find((x) => x.id === s)?.name ?? ""}`.trim();
      const p = before?.classes.get(k) ?? null;
      return { name, now: v, before: p, change: p === null ? null : v - p };
    });
    classes.sort((x, y) => y.now - x.now);
    return {
      now,
      before,
      subjectData,
      top: sorted.filter((c) => c.change > 0).slice(0, 5),
      drops: [...sorted].reverse().filter((c) => c.change < 0).slice(0, 5),
      move,
      classes,
    };
  }, [marks.data, cur, prev, subjects.data, bands.data, grades.data, streams.data, scoped, homeGrade, homeStream]);

  const lname = (id: string) => learners.data?.find((l) => l.id === id)?.full_name ?? "Unknown";
  const examLabel = (e: (typeof list)[number]) => `${e.name} · ${e.term} ${e.year}`;

  if (!list.length) return null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">Compare with last exam</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Exam</Label>
            <Select value={cur} onValueChange={(v) => { setExamSel(v); setPrevSel(""); }}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {list.map((e) => <SelectItem key={e.id} value={e.id}>{examLabel(e)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Compare with</Label>
            <Select value={prev} onValueChange={setPrevSel}>
              <SelectTrigger className="w-56"><SelectValue placeholder="No earlier exam" /></SelectTrigger>
              <SelectContent>
                {list.filter((e) => e.id !== cur).map((e) => <SelectItem key={e.id} value={e.id}>{examLabel(e)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!isAdmin && homeGrade && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={allClasses} onCheckedChange={setAllClasses} />
              View other classes (read-only)
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!prev ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No earlier exam to compare yet.
          </p>
        ) : marks.isLoading || !a ? (
          <p className="text-sm text-muted-foreground">Loading comparison…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Mean now" value={`${fmt(a.now.mean)}%`} />
              <Stat label="Mean before" value={`${fmt(a.before?.mean ?? null)}%`} />
              <div className="rounded-md border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Change</p>
                <p className="mt-1 text-2xl">
                  <Delta v={a.now.mean !== null && a.before?.mean != null ? a.now.mean - a.before.mean : null} suffix="%" />
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Subject means (%)</p>
              {a.subjectData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No marks yet.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={a.subjectData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="subject" fontSize={11} stroke="var(--muted-foreground)" />
                      <YAxis fontSize={11} stroke="var(--muted-foreground)" domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                      <Legend />
                      <Bar dataKey="Current" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Previous" fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MoverList title="Top improvers" items={a.top} name={lname} />
              <MoverList title="Biggest drops" items={a.drops} name={lname} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Performance level movement</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Move label="Moved up" n={a.move.up} cls="text-success" Icon={ArrowUp} />
                <Move label="Stayed the same" n={a.move.same} cls="text-muted-foreground" Icon={Minus} />
                <Move label="Moved down" n={a.move.down} cls="text-destructive" Icon={ArrowDown} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Class comparison (best to weakest)</p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left">
                    <tr><th className="p-2">#</th><th className="p-2">Class</th><th className="p-2">Now</th><th className="p-2">Before</th><th className="p-2">Change</th></tr>
                  </thead>
                  <tbody>
                    {a.classes.map((c, i) => (
                      <tr key={c.name + i} className="border-t border-border">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2">{c.name}</td>
                        <td className="p-2">{fmt(c.now)}%</td>
                        <td className="p-2">{c.before === null ? "–" : `${fmt(c.before)}%`}</td>
                        <td className="p-2"><Delta v={c.change} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function Move({ label, n, cls, Icon }: { label: string; n: number; cls: string; Icon: typeof ArrowUp }) {
  return (
    <div className="rounded-md border border-border p-3">
      <Icon className={`mx-auto h-5 w-5 ${cls}`} />
      <p className={`text-xl font-bold ${cls}`}>{n}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MoverList({ title, items, name }: { title: string; items: { id: string; change: number }[]; name: (id: string) => string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{name(c.id)}</span>
              <Delta v={c.change} suffix=" pts" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
