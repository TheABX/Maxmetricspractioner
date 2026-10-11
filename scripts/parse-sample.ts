import ExcelJS from "exceljs";
import { parseForcePlateSheet } from "../lib/force-plate/parse";
import { deriveTrial } from "../lib/force-plate/derive";
import { interpretForcePlate } from "../lib/force-plate/interpret";

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("/Users/deonkenzie/Downloads/FORCE2026924.xlsx");
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  const parsed = parseForcePlateSheet(rows);
  if (parsed.fileType !== "FORCE_PLATE_EXPORT_V1") {
    throw new Error(parsed.warnings[0]?.message ?? "parse failed");
  }
  console.log(
    JSON.stringify(
      {
        athlete: parsed.athleteName,
        movements: parsed.movements,
        trials: parsed.trials.length,
        byMovement: parsed.movements.map((name) => ({
          name,
          n: parsed.trials.filter((t) => t.movement_name === name).length,
        })),
      },
      null,
      2,
    ),
  );

  const english = parseForcePlateSheet([
    [
      "",
      "Name",
      "Movement",
      "L/R",
      "Peak Force(KG)",
      "Peak Force(%)",
      "Relative Peak Force",
      "Time to Peak Force(ms)",
      "Mean Force(KG)",
      "Mean Force(%)",
      "Force@Peak(KG)",
      "Force@100ms",
      "Force@200ms",
      "Force@300ms",
      "RFD@Peak(N/s)",
      "RFD@100ms",
      "RFD@200ms",
      "RFD@300ms",
      "Impulse@Peak(Ns)",
      "Impulse@100ms",
      "Impulse@200ms",
      "Impulse@300ms",
      "Mean Force@Peak(KG)",
      "Mean Force@100ms",
      "Mean Force@200ms",
      "Mean Force@300ms",
    ],
    [
      "2026-09-12",
      "Sam",
      "Isometric Mid-Thigh Pull",
      "L+R",
      161.2,
      "100%",
      1.84,
      300,
      80,
      "100%",
      161.2,
      50,
      76.4,
      90,
      2814,
      1000,
      800,
      700,
      10,
      4,
      8,
      12,
      100,
      40,
      50,
      60,
    ],
    ["", "", "", "L", 79, "49%", 0.9, 300, 40, "50%", 79, 25, 38, 45, 1400, 500, 400, 350, 5, 2, 4, 6, 50, 20, 25, 30],
    ["", "", "", "R", 82, "51%", 0.94, 300, 40, "50%", 82, 25, 38, 45, 1414, 500, 400, 350, 5, 2, 4, 6, 50, 20, 25, 30],
  ]);
  if (english.fileType !== "FORCE_PLATE_EXPORT_V1") throw new Error("English headers failed");
  console.log("english ok", english.movements, english.trials[0].combined?.peak_force_kg);

  const imtp = parsed.trials.filter((t) => t.movement.testType === "FORCE_PLATE_IMTP");
  const best = [...imtp].sort(
    (a, b) => (b.combined?.peak_force_kg ?? 0) - (a.combined?.peak_force_kg ?? 0),
  )[0];
  const derived = deriveTrial(best, 87.4);
  const interpretation = interpretForcePlate({
    clientFirstName: "Sam",
    movementName: best.movement.displayName,
    peakForceKg: best.combined?.peak_force_kg ?? null,
    relativePeakForce: derived.calculated_relative_peak_force,
    force200msKg: best.combined?.force_200ms_kg ?? null,
    rfdPeakNs: best.combined?.rfd_peak_ns ?? null,
    leftContribution: derived.calculated_left_contribution,
    rightContribution: derived.calculated_right_contribution,
    asymmetryPercent: derived.peak_force_asymmetry_percent,
    weakerSide: derived.weaker_side,
    referenceAvailable: false,
  });
  console.log("best IMTP", best.combined?.peak_force_kg, derived.calculated_relative_peak_force);
  console.log("workOn", interpretation.workOn);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
