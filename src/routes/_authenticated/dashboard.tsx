import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, BookOpen, Layers, ClipboardCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMembership } from "@/lib/auth";
import { ExamComparison } from "@/components/ExamComparison";
import {
  useExams,
  useGradeLevels,
  useLearners,
  useMarksCount,
  useStreams,
  useSubjects,
  useTeachers,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sikinter Marks System" },
      { name: "description", content: "School-wide overview of learners, grades, subjects and marks entered." },
      { property: "og:title", content: "Dashboard — Sikinter Marks System" },
      { property: "og:description", content: "Overview of learners, grades, subjects and marks entered." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { membership } = useMembership();
  const learners = useLearners();
  const grades = useGradeLevels();
  const streams = useStreams();
  const subjects = useSubjects();
  const teachers = useTeachers();
  const exams = useExams();
  const marks = useMarksCount();

  const homeGrade = membership?.teacher?.home_grade_level_id
    ? grades.data?.find((g) => g.id === membership.teacher?.home_grade_level_id)
    : null;

  const stats = [
    { label: "Learners", value: learners.data?.length ?? 0, icon: Users },
    { label: "Grades", value: grades.data?.length ?? 0, icon: Layers },
    { label: "Subjects", value: subjects.data?.length ?? 0, icon: BookOpen },
    { label: "Marks entered", value: marks.data ?? 0, icon: ClipboardCheck },
  ];

  const setupSteps = [
    { label: "Add grade levels and streams", done: (grades.data?.length ?? 0) > 0, to: "/curriculum" },
    { label: "Add subjects per grade", done: (subjects.data?.length ?? 0) > 0, to: "/curriculum" },
    { label: "Add teachers and assignments", done: (teachers.data?.length ?? 0) > 0, to: "/teachers" },
    { label: "Add learners", done: (learners.data?.length ?? 0) > 0, to: "/learners" },
    { label: "Create an exam", done: (exams.data?.length ?? 0) > 0, to: "/exams" },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-document text-2xl font-bold text-foreground">
          Welcome{membership?.fullName ? `, ${membership.fullName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {membership?.isAdmin
            ? "You have full access across all grades."
            : homeGrade
              ? `Your home class: ${homeGrade.name}`
              : "You can view all classes and edit only your assigned subjects."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{s.value}</p>
              </div>
              <s.icon className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <ExamComparison />

      <div className="grid gap-4 lg:grid-cols-2">
        {membership?.isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Set up your school</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {setupSteps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm text-foreground">{step.label}</span>
                  {step.done ? (
                    <Badge variant="secondary">Done</Badge>
                  ) : (
                    <Button asChild size="sm" variant="ghost">
                      <Link to={step.to}>
                        Start <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {(grades.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No grades added yet.</p>
            ) : (
              <ul className="space-y-2">
                {grades.data?.map((g) => {
                  const gradeStreams = streams.data?.filter((s) => s.grade_level_id === g.id) ?? [];
                  const count = learners.data?.filter((l) => l.grade_level_id === g.id).length ?? 0;
                  return (
                    <li
                      key={g.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{g.name}</span>
                      <span className="text-muted-foreground">
                        {gradeStreams.length} stream{gradeStreams.length === 1 ? "" : "s"} · {count} learner
                        {count === 1 ? "" : "s"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
