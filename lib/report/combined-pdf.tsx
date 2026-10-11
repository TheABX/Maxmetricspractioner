import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { type ScaleBodyComposition } from "@/lib/body-comp/scale";
import { type SymmetryStatus } from "@/lib/metrics/stats";
import { SideBars, Spectrum, dualPercentileSpectrum, percentileSpectrum, symmetrySpectrum } from "@/lib/report/pdf-visuals";
import {
  AnatomicalHeatMaps,
  LayerMaps,
  blendHeat,
  pctHeat,
  symmetryHeat,
  type BodyHeat,
} from "@/lib/report/anatomy-map";
import { formatMobilityUnit } from "@/lib/mobility/tests";

const s = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", color: "#1b2430", backgroundColor: "#f6f1e8" },
  header: {
    backgroundColor: "#102a43",
    paddingTop: 22,
    paddingHorizontal: 28,
    paddingBottom: 18,
  },
  brand: { fontSize: 8, letterSpacing: 2, color: "#9ec5e8", textTransform: "uppercase" },
  title: { fontSize: 20, marginTop: 4, color: "#fff", fontFamily: "Helvetica-Bold" },
  headerMeta: { fontSize: 9, marginTop: 4, color: "#c5d7e8" },
  notice: { fontSize: 8, marginTop: 8, color: "#f0d9a6", lineHeight: 1.35 },
  body: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 28 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4ddd2",
  },
  label: { fontSize: 7.5, letterSpacing: 0.7, color: "#6b5e4e", textTransform: "uppercase" },
  value: { fontSize: 18, marginTop: 3, fontFamily: "Helvetica-Bold", color: "#102a43" },
  hint: { fontSize: 8, marginTop: 3, color: "#5c6770", lineHeight: 1.35 },
  meaning: { fontSize: 7.5, marginTop: 5, color: "#4d5a68", lineHeight: 1.35 },
  box: {
    marginTop: 10,
    backgroundColor: "#fff",
    padding: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4ddd2",
  },
  h: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, color: "#102a43" },
  p: { fontSize: 9.5, lineHeight: 1.4, color: "#334155" },
  bullet: { fontSize: 9.5, lineHeight: 1.4, marginTop: 3, color: "#334155" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: "#e4ddd2", paddingVertical: 4 },
  cell: { flex: 1, fontSize: 8, color: "#334155" },
  changeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingVertical: 5,
    borderBottomWidth: 0.4,
    borderBottomColor: "#eee8dc",
  },
  changeLabel: { fontSize: 9, color: "#102a43", width: "42%" },
  changeVals: { fontSize: 9, color: "#4d5a68" },
  changePill: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1f7a4d" },
  foot: { position: "absolute", bottom: 12, left: 28, right: 28, fontSize: 7, color: "#7a7267" },
  legend: { flexDirection: "row", gap: 12, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  swatch: { width: 10, height: 6, borderRadius: 2 },
  legendText: { fontSize: 7, color: "#6b5e4e" },
});

export type ChangeLine = { label: string; from: string; to: string; change: string };

export type CombinedReportData = {
  clientName: string;
  firstName: string;
  dob: string;
  sex: string;
  assessmentDate: string;
  assessmentType: string;
  previousDate?: string | null;
  sampleNotice?: string | null;
  referenceCaption?: string | null;
  bodyComposition?: ScaleBodyComposition | null;
  force?: {
    peakForceKg: number | null;
    relativePeakForce: number | null;
    force200msKg: number | null;
    leftKg: number | null;
    rightKg: number | null;
    leftContribution: number | null;
    rightContribution: number | null;
    asymmetryPercent: number | null;
    weakerSide: string | null;
    whatThisMeasures: string;
    interpretation: string;
    technical: { label: string; value: string }[];
    qc: string;
    peakPercentile?: number | null;
    relativePercentile?: number | null;
    rapidPercentile?: number | null;
  } | null;
  isometric: {
    testType: string;
    name: string;
    whatThisMeasures: string;
    whyItMatters?: string;
    leftKg: number | null;
    rightKg: number | null;
    bilateralKg: number | null;
    relative: number | null;
    asymmetryPercent: number | null;
    weakerSide: string | null;
    symmetryStatus: SymmetryStatus;
    strengthStatus: string;
    interpretation: string;
    programming: string;
    qc: string;
    trials: string;
    percentile?: number | null;
    leftPercentile?: number | null;
    rightPercentile?: number | null;
  }[];
  findings: string[];
  priorities: string[];
  changes: ChangeLine[];
  missingModules: string[];
  grip?: {
    leftKg: number | null;
    rightKg: number | null;
    asymmetryPercent: number | null;
    weakerSide: string | null;
    symmetryStatus: SymmetryStatus;
    whatThisMeasures: string;
    whyItMatters: string;
    interpretation: string;
    qc: string;
    trials: string;
    leftPercentile?: number | null;
    rightPercentile?: number | null;
    relativeBest?: number | null;
    dominantHand?: string | null;
  } | null;
  mobility?: {
    tests: {
      testKey: string;
      name: string;
      clientLabel: string;
      unit: string | null;
      whatThisMeasures: string;
      whyItMatters: string;
      left: number | null;
      right: number | null;
      absoluteDifference: number | null;
      percentageDifference: number | null;
      lowerSide: string | null;
      symmetryStatus: SymmetryStatus;
      leftPercentile?: number | null;
      rightPercentile?: number | null;
      leftCategory?: string | null;
      rightCategory?: string | null;
      leftMean?: number | null;
      rightMean?: number | null;
      referenceAvailable: boolean;
      interpretation: string;
      programming: string;
    }[];
    squat?: {
      interpretation: string;
      programming: string;
      depth?: string;
      heels?: string;
      shift?: string;
      knees?: string;
      trunk?: string;
      arms?: string;
      pain?: string;
      notes?: string;
    } | null;
  } | null;
};

function n(v: number | null | undefined, d = 1, suffix = "") {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(d)}${suffix}`;
}

function Header({
  kicker,
  title,
  data,
}: {
  kicker: string;
  title: string;
  data: CombinedReportData;
}) {
  return (
    <View style={s.header}>
      <Text style={s.brand}>{kicker}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.headerMeta}>
        {data.clientName} · {data.sex} · DOB {data.dob} · {data.assessmentType.replaceAll("_", " ")} ·{" "}
        {data.assessmentDate}
      </Text>
      {data.sampleNotice ? <Text style={s.notice}>{data.sampleNotice}</Text> : null}
    </View>
  );
}

function emptyHeat(): BodyHeat {
  return {
    torso: null,
    leftArm: null,
    rightArm: null,
    leftHip: null,
    rightHip: null,
    leftQuad: null,
    rightQuad: null,
    leftHam: null,
    rightHam: null,
    leftCalf: null,
    rightCalf: null,
  };
}

function mobilityHeats(data: CombinedReportData): BodyHeat {
  const h = emptyHeat();
  for (const t of data.mobility?.tests ?? []) {
    if (!t.referenceAvailable) continue;
    const left = pctHeat(t.leftPercentile);
    const right = pctHeat(t.rightPercentile);
    if (t.testKey === "MOBILITY_KNEE_TO_WALL") {
      h.leftCalf = left;
      h.rightCalf = right;
    } else if (t.testKey === "MOBILITY_ASLR") {
      h.leftHam = left;
      h.rightHam = right;
    } else if (t.testKey === "MOBILITY_HIP_IR") {
      h.leftHip = left;
      h.rightHip = right;
    } else if (t.testKey === "MOBILITY_SHOULDER_FLEXION") {
      h.leftArm = left;
      h.rightArm = right;
    }
  }
  return h;
}

function symmetryLayerHeats(data: CombinedReportData): BodyHeat {
  const maps = isoHeats(data);
  const h: BodyHeat = {
    torso: maps.attention.torso,
    leftArm: maps.attention.leftArm,
    rightArm: maps.attention.rightArm,
    leftHip: maps.attention.leftHip,
    rightHip: maps.attention.rightHip,
    leftQuad: maps.attention.leftQuad,
    rightQuad: maps.attention.rightQuad,
    leftHam: maps.attention.leftHam,
    rightHam: maps.attention.rightHam,
    leftCalf: null,
    rightCalf: null,
  };
  for (const t of data.mobility?.tests ?? []) {
    const left = symmetryHeat(t.percentageDifference, t.lowerSide === "Left");
    const right = symmetryHeat(t.percentageDifference, t.lowerSide === "Right");
    if (t.testKey === "MOBILITY_KNEE_TO_WALL") {
      h.leftCalf = left;
      h.rightCalf = right;
    } else if (t.testKey === "MOBILITY_ASLR") {
      h.leftHam = blendHeat(h.leftHam, left);
      h.rightHam = blendHeat(h.rightHam, right);
    } else if (t.testKey === "MOBILITY_HIP_IR") {
      h.leftHip = blendHeat(h.leftHip, left);
      h.rightHip = blendHeat(h.rightHip, right);
    } else if (t.testKey === "MOBILITY_SHOULDER_FLEXION") {
      h.leftArm = blendHeat(h.leftArm, left);
      h.rightArm = blendHeat(h.rightArm, right);
    }
  }
  return h;
}

function isoHeats(data: CombinedReportData): { attention: BodyHeat; strength: BodyHeat } {
  const force = data.force;
  const global = data.isometric.find((t) => t.testType === "ISO_GLOBAL_LOWER_BODY");
  const knee = data.isometric.find((t) => t.testType === "ISO_KNEE_EXTENSION");
  const flex = data.isometric.find((t) => t.testType === "ISO_KNEE_FLEXION");
  const hip = data.isometric.find((t) => t.testType === "ISO_HIP_ABDUCTION");
  const pull = data.isometric.find((t) => t.testType === "ISO_UPPER_PULL");
  const side = (t: CombinedReportData["isometric"][number] | undefined, left: boolean) =>
    symmetryHeat(t?.asymmetryPercent ?? null, t?.weakerSide === (left ? "Left" : "Right"));
  const strength: BodyHeat = {
    torso: pctHeat(force?.relativePercentile ?? global?.percentile),
    leftArm: pctHeat(pull?.leftPercentile),
    rightArm: pctHeat(pull?.rightPercentile),
    leftHip: pctHeat(hip?.leftPercentile),
    rightHip: pctHeat(hip?.rightPercentile),
    leftQuad: pctHeat(knee?.leftPercentile),
    rightQuad: pctHeat(knee?.rightPercentile),
    leftHam: pctHeat(flex?.leftPercentile),
    rightHam: pctHeat(flex?.rightPercentile),
    leftCalf: null,
    rightCalf: null,
  };
  const attention: BodyHeat = {
    torso: strength.torso,
    leftArm: blendHeat(strength.leftArm, side(pull, true)),
    rightArm: blendHeat(strength.rightArm, side(pull, false)),
    leftHip: blendHeat(strength.leftHip, side(hip, true)),
    rightHip: blendHeat(strength.rightHip, side(hip, false)),
    leftQuad: blendHeat(strength.leftQuad, side(knee, true)),
    rightQuad: blendHeat(strength.rightQuad, side(knee, false)),
    leftHam: blendHeat(strength.leftHam, side(flex, true)),
    rightHam: blendHeat(strength.rightHam, side(flex, false)),
    leftCalf: null,
    rightCalf: null,
  };
  return { attention, strength };
}

function CompositionMix({
  fat,
  muscle,
  bone,
}: {
  fat: number | null;
  muscle: number | null;
  bone: number | null;
}) {
  const f = fat ?? 0;
  const m = muscle ?? 0;
  const b = bone ?? 0;
  const total = f + m + b;
  if (total <= 0) return null;
  return (
    <View>
      <View style={{ flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden" }}>
        <View style={{ flex: f, backgroundColor: "#e3b23c" }} />
        <View style={{ flex: m, backgroundColor: "#2f9e6b" }} />
        <View style={{ flex: b, backgroundColor: "#8a9bb0" }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={s.legendText}>Fat {f.toFixed(1)} kg</Text>
        <Text style={s.legendText}>Muscle {m.toFixed(1)} kg</Text>
        <Text style={s.legendText}>Bone est. {b.toFixed(1)} kg</Text>
      </View>
    </View>
  );
}

function BodyCompositionPage({ data }: { data: CombinedReportData }) {
  const bc = data.bodyComposition;
  if (!bc) return null;
  const fatPos =
    bc.bodyFatPercent == null ? null : Math.max(0.02, Math.min(0.98, (bc.bodyFatPercent - 10) / 22));
  const viscPos =
    bc.visceralFatIndex == null ? null : Math.max(0.02, Math.min(0.98, bc.visceralFatIndex / 15));
  return (
    <Page size="A4" style={s.page}>
      <Header kicker="MAXMetrics · body composition" title="What you are made of today" data={data} />
      <View style={s.body}>
        <Text style={s.p}>
          Measured on a {bc.deviceLabel.toLowerCase()}. This is not a clinical DEXA scan. Same-time-of-day repeats are
          what make it useful.
        </Text>
        <View style={s.row}>
          <View style={s.card}>
            <Text style={s.label}>Weight</Text>
            <Text style={s.value}>{n(bc.weightKg, 1, " kg")}</Text>
            <Text style={s.hint}>BMI {n(bc.bmi, 1)} · height {n(bc.heightCm, 0, " cm")}</Text>
            <Meaning>{bc.whyItMatters.weight}</Meaning>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Body fat</Text>
            <Text style={s.value}>{n(bc.bodyFatPercent, 1, "%")}</Text>
            <Text style={s.hint}>{n(bc.fatMassKg, 1, " kg")} fat mass</Text>
            <Spectrum
              id="bc-fat"
              markers={fatPos == null ? [] : [{ position01: fatPos }]}
              highIsGood={false}
              markerLabel={bc.bodyFatPercent == null ? null : `${bc.bodyFatPercent.toFixed(1)}% of bodyweight`}
              leftLabel="Lower fat"
              rightLabel="Higher fat"
              compact
            />
            <Meaning>{bc.whyItMatters.bodyFat}</Meaning>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Muscle mass</Text>
            <Text style={s.value}>{n(bc.muscleMassKg, 1, " kg")}</Text>
            {percentileSpectrum(bc.musclePercentile ?? null, null, "bc-mus")}
            <Meaning>{bc.whyItMatters.muscle}</Meaning>
          </View>
        </View>
        <View style={s.box}>
          <Text style={s.h}>How the weight splits</Text>
          <CompositionMix fat={bc.fatMassKg} muscle={bc.muscleMassKg} bone={bc.boneMassKg} />
          <Meaning>
            Muscle is the green bar — the tissue that produces force. Fat is the gold bar. Bone is a scale estimate
            only.
          </Meaning>
        </View>
        <View style={s.row}>
          <View style={s.card}>
            <Text style={s.label}>Visceral fat index</Text>
            <Text style={s.value}>{bc.visceralFatIndex == null ? "—" : String(bc.visceralFatIndex)}</Text>
            <Spectrum
              id="bc-visc"
              markers={viscPos == null ? [] : [{ position01: viscPos }]}
              highIsGood={false}
              markerLabel={viscPos == null ? "Not reported" : "Device index, not a scan"}
              leftLabel="Lower"
              rightLabel="Higher"
              compact
            />
            <Meaning>{bc.whyItMatters.visceral}</Meaning>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Body water</Text>
            <Text style={s.value}>{n(bc.bodyWaterPercent, 1, "%")}</Text>
            <Meaning>{bc.whyItMatters.water}</Meaning>
          </View>
          <View style={s.card}>
            <Text style={s.label}>Bone (scale estimate)</Text>
            <Text style={s.value}>{n(bc.boneMassKg, 1, " kg")}</Text>
            <Meaning>{bc.whyItMatters.bone}</Meaning>
          </View>
        </View>
        <View style={s.box}>
          <Text style={s.h}>What this means for you</Text>
          <Text style={s.p}>{bc.interpretation}</Text>
          <Text style={s.hint}>{bc.disclaimer}</Text>
        </View>
        {bc.changes && bc.changes.length > 0 ? (
          <View style={s.box}>
            <Text style={s.h}>Change since last scale reading</Text>
            {bc.changes.map((c) => (
              <View key={c.label} style={s.changeRow}>
                <Text style={s.changeLabel}>{c.label}</Text>
                <Text style={s.changeVals}>
                  {c.from} → {c.to}
                </Text>
                <Text style={s.changePill}>{c.change}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Text style={s.foot}>Page 1 · Scale body composition · not DEXA</Text>
    </Page>
  );
}

function Meaning({ children }: { children: string }) {
  return <Text style={s.meaning}>{children}</Text>;
}

function IsoCard({ t }: { t: CombinedReportData["isometric"][number] }) {
  return (
    <View style={s.box} wrap={false}>
      <Text style={s.h}>{t.name}</Text>
      {t.bilateralKg != null ? (
        <>
          <Text style={s.value}>{n(t.bilateralKg, 1, " kg")}</Text>
          {percentileSpectrum(t.percentile ?? null, null, `${t.testType}-p`)}
        </>
      ) : (
        <>
          <SideBars left={t.leftKg} right={t.rightKg} />
          {dualPercentileSpectrum(t.leftPercentile ?? null, t.rightPercentile ?? null, `${t.testType}-lr`)}
          {symmetrySpectrum(t.asymmetryPercent, t.symmetryStatus, `${t.testType}-s`)}
        </>
      )}
      <Meaning>{t.whyItMatters || t.whatThisMeasures}</Meaning>
    </View>
  );
}

function MobilityPage({ data }: { data: CombinedReportData }) {
  const tests = data.mobility?.tests ?? [];
  const squat = data.mobility?.squat;
  if (!tests.length && !squat) return null;
  const headline = tests.filter((t) => t.symmetryStatus === "priority" || t.symmetryStatus === "monitor").slice(0, 4);
  return (
    <Page size="A4" style={s.page}>
      <Header kicker="MAXMetrics · mobility & movement" title="How you move today" data={data} />
      <View style={s.body}>
        <Text style={s.p}>
          These are measured ranges and observations, not a diagnosis of injury or pathology. Absolute mobility and
          left–right difference are shown separately. Age/sex markers appear only when a matching validated dataset is
          loaded.
        </Text>
        <View style={s.box}>
          <Text style={s.h}>Mobility profile</Text>
          <View style={s.tableRow}>
            <Text style={[s.cell, { flex: 1.4, fontFamily: "Helvetica-Bold" }]}>Test</Text>
            <Text style={[s.cell, { fontFamily: "Helvetica-Bold" }]}>Left</Text>
            <Text style={[s.cell, { fontFamily: "Helvetica-Bold" }]}>Right</Text>
            <Text style={[s.cell, { fontFamily: "Helvetica-Bold" }]}>Difference</Text>
          </View>
          {tests.map((t) => (
            <View key={t.testKey} style={s.tableRow}>
              <Text style={[s.cell, { flex: 1.4 }]}>{t.clientLabel}</Text>
              <Text style={s.cell}>{formatMobilityUnit(t.unit, t.left)}</Text>
              <Text style={s.cell}>{formatMobilityUnit(t.unit, t.right)}</Text>
              <Text style={s.cell}>
                {formatMobilityUnit(t.unit, t.absoluteDifference)}
                {t.lowerSide && t.lowerSide !== "Equal" ? ` · ${t.lowerSide} lower` : ""}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.row}>
          {tests.slice(0, 2).map((t) => (
            <View key={`${t.testKey}-card`} style={[s.card, { marginTop: 8 }]}>
              <Text style={s.h}>{t.name}</Text>
              <SideBars left={t.left} right={t.right} unit={t.unit === "deg" ? "°" : t.unit ?? ""} />
              {t.referenceAvailable
                ? dualPercentileSpectrum(t.leftPercentile ?? null, t.rightPercentile ?? null, `${t.testKey}-p`)
                : percentileSpectrum(null, null, `${t.testKey}-p`)}
              {symmetrySpectrum(t.percentageDifference, t.symmetryStatus, `${t.testKey}-s`)}
              <Meaning>{t.interpretation}</Meaning>
            </View>
          ))}
        </View>
        <View style={s.row}>
          {tests.slice(2, 4).map((t) => (
            <View key={`${t.testKey}-card`} style={[s.card, { marginTop: 0 }]}>
              <Text style={s.h}>{t.name}</Text>
              <SideBars left={t.left} right={t.right} unit={t.unit === "deg" ? "°" : t.unit ?? ""} />
              {t.referenceAvailable
                ? dualPercentileSpectrum(t.leftPercentile ?? null, t.rightPercentile ?? null, `${t.testKey}-p`)
                : percentileSpectrum(null, null, `${t.testKey}-p`)}
              {symmetrySpectrum(t.percentageDifference, t.symmetryStatus, `${t.testKey}-s`)}
              <Meaning>{t.interpretation}</Meaning>
            </View>
          ))}
        </View>

        {squat ? (
          <View style={s.box} wrap={false}>
            <Text style={s.h}>Overhead squat observation</Text>
            <Text style={s.hint}>
              Depth {squat.depth || "—"} · Heels {squat.heels || "—"} · Shift {squat.shift || "—"} · Knees{" "}
              {squat.knees || "—"} · Trunk {squat.trunk || "—"} · Arms {squat.arms || "—"} · Pain {squat.pain || "—"}
            </Text>
            <Meaning>{squat.interpretation}</Meaning>
            <Text style={s.hint}>This observation is not a longevity score and has no population percentile.</Text>
          </View>
        ) : null}

        <View style={s.box}>
          <Text style={s.h}>Mobility map</Text>
          <AnatomicalHeatMaps
            attention={mobilityHeats(data)}
            compact
            caption="Coloured only where a matching age/sex/protocol reference is loaded. Grey means not assessed or insufficient reference information."
          />
        </View>

        {headline.length > 0 ? (
          <View style={s.box}>
            <Text style={s.h}>Mobility findings for the next block</Text>
            {headline.map((t, i) => (
              <Text key={t.testKey} style={s.bullet}>
                {i + 1}. {t.programming}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <Text style={s.foot}>Page 5 · Mobility · not a diagnosis</Text>
    </Page>
  );
}

export function CombinedReportDocument({ data }: { data: CombinedReportData }) {
  const force = data.force;
  const ref = data.referenceCaption ?? "Compared with people of the same age and sex, when a dataset is loaded.";
  const global = data.isometric.find((t) => t.testType === "ISO_GLOBAL_LOWER_BODY");
  const maps = isoHeats(data);

  return (
    <Document>
      <BodyCompositionPage data={data} />
      <Page size="A4" style={s.page}>
        <Header kicker="MAXMetrics · neuromuscular profile" title="Where you sit today" data={data} />
        <View style={s.body}>
          <View style={s.row}>
            <View style={s.card}>
              <Text style={s.label}>Maximal force</Text>
              <Text style={s.value}>{n(force?.peakForceKg ?? null, 1, " kg")}</Text>
              {percentileSpectrum(force?.relativePercentile ?? force?.peakPercentile ?? null, ref, "p1-force")}
              <Meaning>
                How hard you can push with both legs. This is the strength behind standing up, stairs, and carrying
                shopping.
              </Meaning>
            </View>
            <View style={s.card}>
              <Text style={s.label}>Rapid force · 200 ms</Text>
              <Text style={s.value}>{n(force?.force200msKg ?? null, 1, " kg")}</Text>
              {percentileSpectrum(force?.rapidPercentile ?? null, ref, "p1-rapid")}
              <Meaning>
                How quickly that force shows up. It matters if you trip, stumble, or need to catch your balance.
              </Meaning>
            </View>
            <View style={s.card}>
              <Text style={s.label}>Global isometric</Text>
              <Text style={s.value}>{n(global?.bilateralKg ?? null, 1, " kg")}</Text>
              {percentileSpectrum(global?.percentile ?? null, ref, "p1-iso")}
              <Meaning>
                {global?.whyItMatters ||
                  "Overall lower-body strength in one hold — a snapshot of how much force your legs can produce together."}
              </Meaning>
            </View>
          </View>

          {data.grip ? (
            <View style={s.box} wrap={false}>
              <Text style={s.h}>Grip strength</Text>
              <Text style={s.hint}>{data.grip.whatThisMeasures}</Text>
              <SideBars left={data.grip.leftKg} right={data.grip.rightKg} />
              {dualPercentileSpectrum(data.grip.leftPercentile ?? null, data.grip.rightPercentile ?? null, "grip-lr")}
              {symmetrySpectrum(data.grip.asymmetryPercent, data.grip.symmetryStatus, "grip-s")}
              <Meaning>{data.grip.whyItMatters}</Meaning>
              <Text style={s.hint}>
                Best valid squeeze each side, not the average.
                {data.grip.dominantHand ? ` Dominant hand: ${data.grip.dominantHand}.` : ""} {data.grip.qc}
              </Text>
            </View>
          ) : null}

          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: "#c45c4a" }]} />
              <Text style={s.legendText}>Lower / larger gap</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: "#e3b23c" }]} />
              <Text style={s.legendText}>Middle</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: "#2f9e6b" }]} />
              <Text style={s.legendText}>Higher / more even</Text>
            </View>
          </View>

          <View style={s.box}>
            <Text style={s.h}>Regional symmetry at a glance</Text>
            <View style={s.row}>
              {data.isometric
                .filter((t) => t.testType !== "ISO_GLOBAL_LOWER_BODY")
                .slice(0, 2)
                .map((t) => (
                  <View key={`sym-${t.testType}`} style={{ flex: 1 }}>
                    <Text style={s.label}>
                      {t.name}
                      {t.weakerSide ? ` · ${t.weakerSide} lower` : ""}
                    </Text>
                    {symmetrySpectrum(t.asymmetryPercent, t.symmetryStatus, `p1-${t.testType}`)}
                    <Meaning>{t.whyItMatters || t.whatThisMeasures}</Meaning>
                  </View>
                ))}
            </View>
            <View style={s.row}>
              {data.isometric
                .filter((t) => t.testType !== "ISO_GLOBAL_LOWER_BODY")
                .slice(2, 4)
                .map((t) => (
                  <View key={`sym-${t.testType}`} style={{ flex: 1 }}>
                    <Text style={s.label}>
                      {t.name}
                      {t.weakerSide ? ` · ${t.weakerSide} lower` : ""}
                    </Text>
                    {symmetrySpectrum(t.asymmetryPercent, t.symmetryStatus, `p1b-${t.testType}`)}
                    <Meaning>{t.whyItMatters || t.whatThisMeasures}</Meaning>
                  </View>
                ))}
            </View>
          </View>

          {data.changes.length > 0 && (
            <View style={s.box}>
              <Text style={s.h}>Change since {data.previousDate}</Text>
              <Meaning>This is how today’s result compares with your last visit — often the most useful number on the page.</Meaning>
              {data.changes.map((c) => (
                <View key={c.label} style={s.changeRow}>
                  <Text style={s.changeLabel}>{c.label}</Text>
                  <Text style={s.changeVals}>
                    {c.from} → {c.to}
                  </Text>
                  <Text style={s.changePill}>{c.change}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={s.foot}>Page 2 · Incomplete modules: {data.missingModules.join(", ") || "none"}</Text>
      </Page>

      <Page size="A4" style={s.page}>
        <Header kicker="Force plate" title="Maximal and rapid force" data={data} />
        <View style={s.body}>
          <Text style={s.p}>{force?.whatThisMeasures}</Text>
          {force ? (
            <>
              <View style={s.row}>
                <View style={s.card}>
                  <Text style={s.label}>Peak force</Text>
                  <Text style={s.value}>{n(force.peakForceKg, 1, " kg")}</Text>
                  {percentileSpectrum(force.peakPercentile ?? null, ref, "fp-peak")}
                  <Meaning>
                    The hardest you pushed today. Think standing up, stairs, and picking up a heavy bag.
                  </Meaning>
                </View>
                <View style={s.card}>
                  <Text style={s.label}>Relative peak force</Text>
                  <Text style={s.value}>{n(force.relativePeakForce, 2, " × BW")}</Text>
                  {percentileSpectrum(force.relativePercentile ?? null, ref, "fp-rel")}
                  <Meaning>
                    Force for your bodyweight. It answers whether that effort is strong for someone your size.
                  </Meaning>
                </View>
              </View>
              <View style={s.box}>
                <Text style={s.h}>Rapid force production</Text>
                <Text style={s.value}>{n(force.force200msKg, 1, " kg")} at 200 ms</Text>
                {percentileSpectrum(force.rapidPercentile ?? null, ref, "fp-rapid")}
                <Meaning>
                  How fast the force arrived. This is closer to catching yourself than to a slow, heavy lift.
                </Meaning>
              </View>
              <View style={s.box}>
                <Text style={s.h}>Left and right contribution</Text>
                <SideBars left={force.leftKg} right={force.rightKg} />
                {symmetrySpectrum(force.asymmetryPercent, force.asymmetryPercent == null ? "unavailable" : force.asymmetryPercent <= 10 ? "balanced" : force.asymmetryPercent <= 20 ? "monitor" : "priority", "fp-sym")}
                <Meaning>
                  Whether both legs shared the work. A difference is not automatically a problem, and it is not an
                  injury diagnosis.
                </Meaning>
              </View>
              <View style={s.box}>
                <Text style={s.h}>Technical results</Text>
                {force.technical.map((row) => (
                  <View key={row.label} style={s.tableRow}>
                    <Text style={s.cell}>{row.label}</Text>
                    <Text style={s.cell}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={s.p}>Force plates not completed for this assessment.</Text>
          )}
        </View>
        <Text style={s.foot}>Page 3 · Force plate</Text>
      </Page>

      <Page size="A4" style={s.page}>
        <Header kicker="Isometric strength" title="Regional force and symmetry" data={data} />
        <View style={s.body}>
          <Text style={s.p}>
            Best valid trial, not the average. Blue arrow = left vs age/sex. Green arrow = right. The second bar is
            symmetry, which is a different question.
          </Text>
          {global ? <IsoCard t={global} /> : null}
          <View style={s.row}>
            {data.isometric
              .filter((t) => t.testType !== "ISO_GLOBAL_LOWER_BODY")
              .slice(0, 2)
              .map((t) => (
                <View key={t.testType} style={{ flex: 1 }}>
                  <IsoCard t={t} />
                </View>
              ))}
          </View>
          <View style={s.row}>
            {data.isometric
              .filter((t) => t.testType !== "ISO_GLOBAL_LOWER_BODY")
              .slice(2, 4)
              .map((t) => (
                <View key={t.testType} style={{ flex: 1 }}>
                  <IsoCard t={t} />
                </View>
              ))}
          </View>
          {data.isometric.length === 0 && <Text style={s.p}>Isometric strength not completed.</Text>}
        </View>
        <Text style={s.foot}>Page 4 · Isometric · Blue marker = left · Green marker = right</Text>
      </Page>

      <MobilityPage data={data} />

      <Page size="A4" style={s.page}>
        <Header kicker="What this means for you" title="Map, findings, next 12 weeks" data={data} />
        <View style={s.body}>
          <View style={s.box}>
            <Text style={s.h}>Strength · symmetry · mobility</Text>
            <Text style={s.p}>
              Three layers of the same figure. Strength uses loaded population comparison. Symmetry uses left–right
              difference. Mobility stays grey until a matching reference dataset is loaded — a lower side is not
              automatically painted red.
            </Text>
            <LayerMaps
              strength={maps.strength}
              symmetry={symmetryLayerHeats(data)}
              mobility={mobilityHeats(data)}
            />
            <Text style={s.hint}>
              This diagram is an illustrative representation of assessment findings. Highlighted regions represent
              measured mobility and/or side-to-side differences and should not be interpreted as a diagnosis of injury,
              pathology or dysfunction.
            </Text>
          </View>
          <View style={s.box}>
            <Text style={s.h}>Key findings</Text>
            {data.findings.map((f, i) => (
              <Text key={f} style={s.bullet}>
                {i + 1}. {f}
              </Text>
            ))}
          </View>
          <View style={s.box}>
            <Text style={s.h}>Program priority · next 12 weeks</Text>
            {data.priorities.map((p, i) => (
              <Text key={p} style={s.bullet}>
                {i + 1}. {p}
              </Text>
            ))}
          </View>
        </View>
        <Text style={s.foot}>Page 6 · {data.referenceCaption ?? "References: none loaded"}</Text>
      </Page>
    </Document>
  );
}

export async function renderCombinedReport(data: CombinedReportData) {
  return renderToBuffer(<CombinedReportDocument data={data} />);
}
