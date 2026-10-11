import { readFile } from "fs/promises";
import ExcelJS from "exceljs";
import { parseForcePlateSheet } from "@/lib/force-plate/parse";
import { buildClientReport } from "@/lib/force-plate/report";
import { renderForcePlatePdf } from "@/lib/force-plate/pdf";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const file = await readFile("/Users/deonkenzie/Downloads/FORCE2026924.xlsx");
  await workbook.xlsx.load(file as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  const parsed = parseForcePlateSheet(rows);
  const data = buildClientReport({
    clientName: "Sam Smith",
    firstName: "Sam",
    dob: "14 June 1974",
    sex: "Male",
    assessmentDate: "12 September 2026",
    bodyweightKg: 87.4,
    trials: parsed.trials,
  });
  const pdf = await renderForcePlatePdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="MAXMetrics_Force_Plate_Sample.pdf"',
    },
  });
}
