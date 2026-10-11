import { deriveTrial, selectBestTrialIndex } from "./derive";
import { interpretForcePlate } from "./interpret";
import type { ForcePlateTrialPreview } from "./parse";
import type { ForcePlatePdfData, ForcePlatePdfSection } from "./pdf";

export function buildClientReport(options: {
  clientName: string;
  firstName: string;
  dob: string;
  sex: string;
  assessmentDate: string;
  bodyweightKg: number;
  trials: ForcePlateTrialPreview[];
}): ForcePlatePdfData {
  const reportTrials = options.trials.filter((trial) => trial.movement.includeInClientReport);
  const grouped = new Map<string, ForcePlateTrialPreview[]>();
  for (const trial of reportTrials) {
    const list = grouped.get(trial.movement.testType) ?? [];
    list.push(trial);
    grouped.set(trial.movement.testType, list);
  }

  const order = ["FORCE_PLATE_IMTP", "FORCE_PLATE_ISOMETRIC_DEADLIFT", "FORCE_PLATE_SOLEUS"];
  const keys = [...grouped.keys()].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const sections: ForcePlatePdfSection[] = keys.map((key) => {
    const trials = grouped.get(key) ?? [];
    const bestIndex = selectBestTrialIndex(
      trials.map((trial) => ({
        combinedPeak: trial.combined?.peak_force_kg ?? null,
        excluded: false,
      })),
    );
    const best = trials[bestIndex] ?? trials[0];
    const derived = deriveTrial(best, options.bodyweightKg);
    const interpretation = interpretForcePlate({
      clientFirstName: options.firstName,
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
    return {
      movement: best.movement.displayName,
      whatWeTested: interpretation.whatWeTested,
      peakForceKg: best.combined?.peak_force_kg ?? null,
      relativePeakForce: derived.calculated_relative_peak_force,
      force200msKg: best.combined?.force_200ms_kg ?? null,
      leftContribution: derived.calculated_left_contribution,
      rightContribution: derived.calculated_right_contribution,
      asymmetryPercent: derived.peak_force_asymmetry_percent,
      interpretation,
      technical: [
        { label: "Peak force", value: `${best.combined?.peak_force_kg?.toFixed(1) ?? "—"} kg` },
        {
          label: "Relative force",
          value: derived.calculated_relative_peak_force
            ? `${derived.calculated_relative_peak_force.toFixed(2)} × bodyweight`
            : "—",
        },
        { label: "Force at 200 ms", value: `${best.combined?.force_200ms_kg?.toFixed(1) ?? "—"} kg` },
        {
          label: "Left / right",
          value: `${derived.calculated_left_contribution?.toFixed(0) ?? "—"}% / ${derived.calculated_right_contribution?.toFixed(0) ?? "—"}%`,
        },
        {
          label: "Asymmetry",
          value: `${derived.peak_force_asymmetry_percent?.toFixed(1) ?? "—"}%`,
        },
      ],
    };
  });

  return {
    clientName: options.clientName,
    firstName: options.firstName,
    dob: options.dob,
    sex: options.sex,
    assessmentDate: options.assessmentDate,
    sections,
  };
}
