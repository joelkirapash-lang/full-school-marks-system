import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  examId: z.string().uuid(),
  examLabel: z.string().max(200),
  items: z
    .array(z.object({ learnerId: z.string().uuid(), pdfBase64: z.string().max(3_000_000) }))
    .min(1)
    .max(10),
});

export type SendResult = { learnerId: string; status: "sent" | "failed" | "no_email"; error?: string };

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

/** Emails report card PDFs to parents. Only admins or the learner's class teacher may send. */
export const sendReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<SendResult[]> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const resendKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESEND_FROM_EMAIL"] || "onboarding@resend.dev";
    const { data: settings } = await context.supabase.from("school_settings").select("school_name, email").maybeSingle();
    const school = settings?.school_name || "Sikinter Primary and Junior School";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: SendResult[] = [];

    for (const item of data.items) {
      const { data: allowed } = await context.supabase.rpc("can_send_report", { _learner_id: item.learnerId });
      if (!allowed) {
        results.push({ learnerId: item.learnerId, status: "failed", error: "Not permitted" });
        continue;
      }
      const { data: learner } = await context.supabase
        .from("learners")
        .select("full_name, guardian_email, guardian_name")
        .eq("id", item.learnerId)
        .maybeSingle();
      const to = learner?.guardian_email?.trim();
      let res: SendResult;
      if (!learner || !to) {
        res = { learnerId: item.learnerId, status: "no_email" };
      } else if (!lovableKey || !resendKey) {
        res = { learnerId: item.learnerId, status: "failed", error: "Email service not connected" };
      } else {
        const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
        const html = `<p>Dear ${esc(learner.guardian_name || "Parent/Guardian")},</p>
<p>Please find attached the report card for <b>${esc(learner.full_name)}</b> for <b>${esc(data.examLabel)}</b>.</p>
<p>Kind regards,<br/>${esc(school)}</p>`;
        try {
          const r = await fetch(`${GATEWAY_URL}/emails`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": resendKey,
            },
            body: JSON.stringify({
              from: `${school} <${from}>`,
              to: [to],
              reply_to: settings?.email || undefined,
              subject: `${learner.full_name} — Report card, ${data.examLabel}`,
              html,
              attachments: [
                { filename: `${learner.full_name.replace(/[^\w-]+/g, "_")}_report_card.pdf`, content: item.pdfBase64 },
              ],
            }),
          });
          if (r.ok) res = { learnerId: item.learnerId, status: "sent" };
          else {
            const body = await r.text();
            console.error(`Resend failed [${r.status}]: ${body}`);
            res = { learnerId: item.learnerId, status: "failed", error: `Email service error ${r.status}: ${body.slice(0, 200)}` };
          }
        } catch (e) {
          res = { learnerId: item.learnerId, status: "failed", error: (e as Error).message };
        }
      }
      await supabaseAdmin.from("report_card_sends").insert({
        learner_id: item.learnerId,
        exam_id: data.examId,
        status: res.status,
        recipient: to ?? null,
        error: res.error ?? null,
        sent_by: context.userId,
      });
      results.push(res);
    }
    return results;
  });
