import { renderCombinedReport } from "@/lib/report/combined-pdf";
import { buildSampleCombinedReport } from "@/lib/report/sample-combined-data";

export async function GET() {
  const pdf = await renderCombinedReport(buildSampleCombinedReport());
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="MAXMetrics_Sample_Combined_Report.pdf"',
    },
  });
}
