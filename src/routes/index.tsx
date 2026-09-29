import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraduationCap, ClipboardList, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sikinter Primary and Junior School — Marks System" },
      {
        name: "description",
        content:
          "Sign in to record CBC assessment scores, generate marklists and print report cards for Playgroup through Grade 10.",
      },
      { property: "og:title", content: "Sikinter Primary and Junior School — Marks System" },
      {
        property: "og:description",
        content: "CBC marks, marklists and report cards for Playgroup through Grade 10.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ClipboardList, title: "Marks entry", text: "Score grids per subject, stream and exam." },
  { icon: FileText, title: "Marklists & reports", text: "Ranked marklists and printable report forms." },
  { icon: GraduationCap, title: "CBC levels", text: "BE, AE, ME and EE levels from your own score bands." },
  { icon: ShieldCheck, title: "Real permissions", text: "Teachers only edit the classes they are assigned." },
];

function Landing() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Competency-Based Curriculum
        </span>
        <h1 className="font-document mt-4 text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          Sikinter Primary and Junior School
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Marks System — Playgroup to Grade 10
        </p>
        <div className="gold-rule mt-8 w-40" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-4">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-sm font-semibold text-card-foreground">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Button asChild size="lg">
            <Link to="/auth">Sign in to continue</Link>
          </Button>
        </div>
      </main>
      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        Powered by Sikinter Marks System
      </footer>
    </div>
  );
}
