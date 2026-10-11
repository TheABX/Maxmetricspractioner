import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Interpretation } from "./interpret";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    color: "#1b2430",
    backgroundColor: "#f6f1e8",
  },
  kicker: { fontSize: 9, letterSpacing: 1.8, color: "#6b5e4e", textTransform: "uppercase" },
  title: { fontSize: 22, marginTop: 6, fontFamily: "Helvetica-Bold" },
  hello: { fontSize: 11, marginTop: 8, lineHeight: 1.45, color: "#3d4a57" },
  row: { flexDirection: "row", gap: 8, marginTop: 14 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4ddd2",
  },
  metricLabel: { fontSize: 8, letterSpacing: 0.8, color: "#6b5e4e", textTransform: "uppercase" },
  metricValue: { fontSize: 16, marginTop: 4, fontFamily: "Helvetica-Bold" },
  metricHint: { fontSize: 8, marginTop: 4, color: "#5c6770", lineHeight: 1.35 },
  section: {
    marginTop: 12,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4ddd2",
  },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  body: { fontSize: 10, lineHeight: 1.45 },
  bullet: { fontSize: 10, lineHeight: 1.45, marginTop: 3 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: "#e4ddd2", paddingVertical: 3 },
  tableCell: { flex: 1, fontSize: 8, color: "#4d5a68" },
  foot: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7.5, color: "#7a7267" },
});

export type ForcePlatePdfSection = {
  movement: string;
  whatWeTested: string;
  peakForceKg: number | null;
  relativePeakForce: number | null;
  force200msKg: number | null;
  leftContribution: number | null;
  rightContribution: number | null;
  asymmetryPercent: number | null;
  interpretation: Interpretation;
  technical: { label: string; value: string }[];
};

export type ForcePlatePdfData = {
  clientName: string;
  firstName: string;
  dob: string;
  sex: string;
  assessmentDate: string;
  sections: ForcePlatePdfSection[];
};

function fmt(n: number | null, digits = 1, suffix = "") {
  if (n === null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}

export function ForcePlateReportDocument({ data }: { data: ForcePlatePdfData }) {
  const lead = data.sections[0];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>MAXMetrics · Your force results</Text>
        <Text style={styles.title}>How your lower body produced force</Text>
        <Text style={styles.hello}>
          {data.firstName}, this page is written for you, not for a lab. We measured how hard and how quickly you
          could push into the force plates on {data.assessmentDate}. The full numbers are stored in your file. Here
          is what they mean in everyday language.
        </Text>

        {lead && (
          <View style={styles.row}>
            <View style={styles.card}>
              <Text style={styles.metricLabel}>Your strongest effort</Text>
              <Text style={styles.metricValue}>
                {lead.relativePeakForce
                  ? `${lead.relativePeakForce.toFixed(2)} × your bodyweight`
                  : fmt(lead.peakForceKg, 1, " kg")}
              </Text>
              <Text style={styles.metricHint}>{lead.interpretation.peakForce}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.metricLabel}>Left and right</Text>
              <Text style={styles.metricValue}>
                {fmt(lead.leftContribution, 0, "%")} / {fmt(lead.rightContribution, 0, "%")}
              </Text>
              <Text style={styles.metricHint}>{lead.interpretation.symmetry}</Text>
            </View>
          </View>
        )}

        {lead && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How quickly the force showed up</Text>
            <Text style={styles.body}>{lead.interpretation.rapidForce}</Text>
          </View>
        )}

        {lead && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What you should work on</Text>
            {lead.interpretation.workOn.map((item) => (
              <Text key={item} style={styles.bullet}>
                • {item}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why this matters</Text>
          <Text style={styles.body}>{lead?.interpretation.whyItMatters}</Text>
        </View>

        {data.sections.map((section) => (
          <View key={section.movement} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.movement}</Text>
            <Text style={styles.body}>{section.whatWeTested}</Text>
            <Text style={{ ...styles.body, marginTop: 6 }}>{section.interpretation.summary}</Text>
            <View style={{ marginTop: 8 }}>
              {section.technical.map((row) => (
                <View key={row.label} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{row.label}</Text>
                  <Text style={styles.tableCell}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.foot}>
          {data.clientName} · DOB {data.dob} · {data.sex}. Generated from stored MAXMetrics results, not from the
          Excel file directly. We do not invent population percentiles.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderForcePlatePdf(data: ForcePlatePdfData) {
  return renderToBuffer(<ForcePlateReportDocument data={data} />);
}
