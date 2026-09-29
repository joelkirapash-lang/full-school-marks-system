import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolSettings } from "@/lib/queries";
import { fileToCompressedDataUrl } from "@/lib/image";
import { useMembership, logActivity } from "@/lib/auth";
import { AdminOnly } from "@/components/AdminOnly";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "School Settings — Sikinter Marks System" },
      {
        name: "description",
        content: "School name, motto, contacts, logo, next term date and report card footer.",
      },
      { property: "og:title", content: "School Settings — Sikinter Marks System" },
      {
        property: "og:description",
        content: "School name, motto, contacts, logo and report card footer.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { membership } = useMembership();
  const settings = useSchoolSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    school_name: "",
    motto: "",
    address: "",
    phone: "",
    email: "",
    next_term_begins: "",
    report_footer_text: "",
    logo_url: "" as string | null,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      school_name: settings.data.school_name ?? "",
      motto: settings.data.motto ?? "",
      address: settings.data.address ?? "",
      phone: settings.data.phone ?? "",
      email: settings.data.email ?? "",
      next_term_begins: settings.data.next_term_begins ?? "",
      report_footer_text: settings.data.report_footer_text ?? "",
      logo_url: settings.data.logo_url ?? "",
    });
  }, [settings.data]);

  async function uploadLogo(file: File) {
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 400);
      setForm((f) => ({ ...f, logo_url: dataUrl }));
      toast.success("Logo ready — remember to save");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("school_settings")
      .update({
        school_name: form.school_name,
        motto: form.motto,
        address: form.address,
        phone: form.phone,
        email: form.email,
        next_term_begins: form.next_term_begins || null,
        report_footer_text: form.report_footer_text,
        logo_url: form.logo_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("Updated school settings", "school_settings");
    toast.success("Settings saved");
    queryClient.invalidateQueries({ queryKey: ["school_settings"] });
  }

  if (!membership?.isAdmin) return <AdminOnly />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-document text-2xl font-bold">School settings</h1>
        <p className="text-sm text-muted-foreground">
          These details appear on marklists and report cards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">School identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt="School logo"
                className="h-20 w-20 rounded-md border border-border object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                No logo
              </div>
            )}
            <div>
              <Label htmlFor="logo" className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" /> Upload logo
                </span>
              </Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">PNG or JPG, square works best.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="school_name">School name</Label>
              <Input
                id="school_name"
                value={form.school_name}
                maxLength={150}
                onChange={(e) => setForm({ ...form, school_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="motto">Motto</Label>
              <Input
                id="motto"
                value={form.motto}
                maxLength={150}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                maxLength={40}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                maxLength={200}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_term">Next term begins on</Label>
              <Input
                id="next_term"
                type="date"
                value={form.next_term_begins}
                onChange={(e) => setForm({ ...form, next_term_begins: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="footer">Report card footer text</Label>
              <Textarea
                id="footer"
                value={form.report_footer_text}
                maxLength={300}
                onChange={(e) => setForm({ ...form, report_footer_text: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
