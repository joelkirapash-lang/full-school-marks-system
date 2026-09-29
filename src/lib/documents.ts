import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "@e965/xlsx";
import type { ClassRow, Subject, Band } from "@/lib/marks";
import { bandFor, fmt } from "@/lib/marks";

type Settings = {
  school_name: string;
  motto?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  next_term_begins?: string | null;
  report_footer_text?: string | null;
} | null;

const NAVY: [number, number, number] = [18, 32, 64];
const GOLD: [number, number, number] = [201, 162, 39];

function header(doc: jsPDF, settings: Settings, title: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.rect(6, 6, w - 12, h - 12);
  if (settings?.logo_url?.startsWith("data:")) {
    try {
      doc.addImage(settings.logo_url, 12, 10, 20, 20);
    } catch {
      /* ignore bad logo */
    }
  }
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(settings?.school_name || "Sikinter Primary and Junior School", w / 2, 16, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(80);
  const sub = [settings?.motto, settings?.address, settings?.phone, settings?.email].filter(Boolean).join("  ·  ");
  if (sub) doc.text(sub, w / 2, 21, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(title, w / 2, 28, { align: "center" });
  doc.setDrawColor(...GOLD);
  doc.line(12, 32, w - 12, 32);
}

function footer(doc: jsPDF, settings: Settings) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120);
  if (settings?.report_footer_text) doc.text(settings.report_footer_text, w / 2, h - 13, { align: "center" });
  doc.text("Powered by Sikinter Marks System", w / 2, h - 9, { align: "center" });
}

const tableStyles = {
  theme: "grid" as const,
  styles: { font: "times", fontSize: 9, lineColor: [120, 120, 120] as [number, number, number], lineWidth: 0.2 },
  headStyles: { fillColor: NAVY, textColor: GOLD, fontStyle: "bold" as const },
};

export type MarklistInput = {
  title: string;
  classTeacher: string;
  rows: ClassRow[];
  subjects: Subject[];
  subjectMeans: Record<string, number | null>;
  bands: Band[];
  settings: Settings;
};

function marklistMatrix(m: MarklistInput) {
  const head = ["#", "Adm", "Name", ...m.subjects.map((s) => s.short_name || s.name), "Total", "Mean", "Lvl"];
  const body = m.rows.map((r) => [
    String(r.rank),
    r.learner.admission_no,
    r.learner.full_name,
    ...m.subjects.map((s) => fmt(r.scores[s.id], 0)),
    fmt(r.total, 0),
    fmt(r.mean),
    bandFor(r.mean, 100, m.bands)?.level_code ?? "–",
  ]);
  const foot = ["", "", "Subject mean", ...m.subjects.map((s) => fmt(m.subjectMeans[s.id])), "", "", ""];
  return { head, body, foot };
}

export function marklistPdf(m: MarklistInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  header(doc, m.settings, m.title);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Class teacher: ${m.classTeacher || "Not assigned"}`, 12, 38);
  const { head, body, foot } = marklistMatrix(m);
  autoTable(doc, {
    ...tableStyles,
    startY: 41,
    margin: { left: 12, right: 12, bottom: 18 },
    head: [head],
    body,
    foot: [foot],
    footStyles: { fillColor: [240, 232, 205], textColor: NAVY, fontStyle: "bold" },
    didDrawPage: () => footer(doc, m.settings),
  });
  doc.save(`${m.title.replace(/[^\w-]+/g, "_")}.pdf`);
}

export function marklistExcel(m: MarklistInput) {
  const { head, body, foot } = marklistMatrix(m);
  const ws = XLSX.utils.aoa_to_sheet([[m.title], [`Class teacher: ${m.classTeacher || "Not assigned"}`], [], head, ...body, foot]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Marklist");
  XLSX.writeFile(wb, `${m.title.replace(/[^\w-]+/g, "_")}.xlsx`);
}

export type ReportInput = {
  examLabel: string;
  gradeName: string;
  streamName: (id: string | null) => string;
  classTeacher: (streamId: string | null) => string;
  rows: ClassRow[];
  subjects: Subject[];
  bands: Band[];
  settings: Settings;
  comments: Record<string, { teacher: string; head: string }>;
};

export function reportCardsPdf(r: ReportInput, only?: string[], asBase64 = false): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const list = only ? r.rows.filter((x) => only.includes(x.learner.id)) : r.rows;
  list.forEach((row, idx) => {
    if (idx > 0) doc.addPage();
    header(doc, r.settings, `LEARNER REPORT CARD — ${r.examLabel}`);
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);
    const l = row.learner;
    doc.text(`Name: ${l.full_name}`, 12, 39);
    doc.text(`Adm No: ${l.admission_no}`, 120, 39);
    doc.text(`Grade: ${r.gradeName} ${r.streamName(l.stream_id)}`, 12, 45);
    doc.text(`UPI: ${l.upi_number || "–"}`, 120, 45);
    doc.text(`Position: ${row.rank} out of ${r.rows.length}`, 12, 51);
    doc.text(`Class teacher: ${r.classTeacher(l.stream_id) || "–"}`, 120, 51);
    autoTable(doc, {
      ...tableStyles,
      startY: 56,
      margin: { left: 12, right: 12 },
      head: [["Learning area", "Score", "Out of", "Level", "Remarks"]],
      body: r.subjects.map((s) => {
        const sc = row.scores[s.id];
        const b = bandFor(sc, s.max_score, r.bands);
        return [s.name, fmt(sc, 0), String(s.max_score), b ? `${b.level_code} ${b.label}` : "–", row.remarks[s.id] || ""];
      }),
      foot: [["Total / Mean", fmt(row.total, 0), "", bandFor(row.mean, 100, r.bands)?.level_code ?? "–", `Mean: ${fmt(row.mean)}`]],
      footStyles: { fillColor: [240, 232, 205], textColor: NAVY, fontStyle: "bold" },
    });
    // @ts-expect-error lastAutoTable is added by the plugin
    let y = (doc.lastAutoTable?.finalY ?? 150) + 8;
    const c = r.comments[l.id] ?? { teacher: "", head: "" };
    const box = (label: string, text: string) => {
      doc.setDrawColor(120);
      doc.rect(12, y, w - 24, 18);
      doc.setFont("times", "bold");
      doc.text(label, 14, y + 5);
      doc.setFont("times", "normal");
      doc.text(doc.splitTextToSize(text || "", w - 30), 14, y + 10);
      y += 21;
    };
    box("Class teacher's remarks", c.teacher);
    box("Head teacher's remarks", c.head);
    const bw = (w - 24 - 8) / 3;
    ["Class teacher signature", "Head teacher signature", "School stamp"].forEach((label, i) => {
      const x = 12 + i * (bw + 4);
      doc.rect(x, y, bw, 24);
      doc.setFontSize(8);
      doc.text(label, x + 2, y + 22);
    });
    y += 30;
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    const next = r.settings?.next_term_begins
      ? new Date(r.settings.next_term_begins).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "To be announced";
    doc.text(`Next term begins: ${next}`, 12, y);
    footer(doc, r.settings);
  });
  const name = list.length === 1 && list[0] ? list[0].learner.full_name : `${r.gradeName}_report_cards`;
  if (asBase64) return doc.output("datauristring").split(",")[1] ?? "";
  doc.save(`${name.replace(/[^\w-]+/g, "_")}.pdf`);
  return "";
}
