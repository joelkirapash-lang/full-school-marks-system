import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/lib/auth";
import { AdminOnly } from "@/components/AdminOnly";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Sikinter Marks System" },
      { name: "description", content: "Who added or changed records, and when." },
      { property: "og:title", content: "Activity Log — Sikinter Marks System" },
      { property: "og:description", content: "Who added or changed records, and when." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { membership } = useMembership();
  const log = useQuery({
    queryKey: ["activity_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  if (!membership?.isAdmin) return <AdminOnly />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-document text-2xl font-bold">Activity log</h1>
        <p className="text-sm text-muted-foreground">The 300 most recent changes.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Area</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(log.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Nothing recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {log.data?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{row.actor_name ?? "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{row.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.entity ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
