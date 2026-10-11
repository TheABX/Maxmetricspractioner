/**
 * Look up mobility norms only from loaded reference_values rows.
 * Never interpolate or invent percentiles.
 */

export type MobilityReferenceQuery = {
  metricKey: string;
  protocol?: string | null;
  sex?: string | null;
  ageYears?: number | null;
  side?: "L" | "R" | null;
};

export type MobilityReferenceHit = {
  datasetId: string;
  mean: number | null;
  sd: number | null;
  percentile: number | null;
  category: string | null;
  source: string | null;
};

export type ReferenceValueRow = {
  dataset_id: string;
  metric_key: string;
  protocol: string | null;
  sex: string | null;
  age_min: number | null;
  age_max: number | null;
  side: string | null;
  mean_value: number | null;
  standard_deviation: number | null;
  percentile_5: number | null;
  percentile_10: number | null;
  percentile_25: number | null;
  percentile_50: number | null;
  percentile_75: number | null;
  percentile_90: number | null;
  percentile_95: number | null;
};

function rowMatches(row: ReferenceValueRow, q: MobilityReferenceQuery) {
  if (row.metric_key !== q.metricKey) return false;
  if (q.protocol && row.protocol && row.protocol !== q.protocol) return false;
  if (q.sex && row.sex && row.sex.toLowerCase() !== q.sex.toLowerCase()) return false;
  if (q.ageYears != null) {
    if (row.age_min != null && q.ageYears < row.age_min) return false;
    if (row.age_max != null && q.ageYears > row.age_max) return false;
  }
  if (q.side && row.side && row.side !== q.side) return false;
  return true;
}

/**
 * Map a measured value onto stored percentile *points* only.
 * If the dataset does not include those columns, percentile stays null.
 * No interpolation between points.
 */
export function percentileFromStoredPoints(
  value: number | null,
  row: Pick<
    ReferenceValueRow,
    | "percentile_5"
    | "percentile_10"
    | "percentile_25"
    | "percentile_50"
    | "percentile_75"
    | "percentile_90"
    | "percentile_95"
  >,
): number | null {
  if (value == null) return null;
  const points: [number, number][] = [
    [5, row.percentile_5],
    [10, row.percentile_10],
    [25, row.percentile_25],
    [50, row.percentile_50],
    [75, row.percentile_75],
    [90, row.percentile_90],
    [95, row.percentile_95],
  ].filter((p): p is [number, number] => p[1] != null);
  if (points.length === 0) return null;
  const exact = points.find(([, v]) => v === value);
  if (exact) return exact[0];
  return null;
}

export function categoryFromStoredPoints(
  value: number | null,
  row: Pick<ReferenceValueRow, "percentile_25" | "percentile_50" | "percentile_75" | "mean_value">,
): string | null {
  if (value == null) return null;
  if (row.percentile_25 != null && row.percentile_75 != null && row.percentile_50 != null) {
    if (value < row.percentile_25) return "below_average";
    if (value < row.percentile_50) return "average";
    if (value < row.percentile_75) return "good";
    return "high";
  }
  if (row.mean_value != null) {
    if (value < row.mean_value) return "below_mean";
    if (value > row.mean_value) return "above_mean";
    return "at_mean";
  }
  return null;
}

export function matchReferenceRow(rows: ReferenceValueRow[], query: MobilityReferenceQuery) {
  return rows.find((row) => rowMatches(row, query)) ?? null;
}

export function hitFromRow(row: ReferenceValueRow | null, value: number | null): MobilityReferenceHit | null {
  if (!row) return null;
  return {
    datasetId: row.dataset_id,
    mean: row.mean_value,
    sd: row.standard_deviation,
    percentile: percentileFromStoredPoints(value, row),
    category: categoryFromStoredPoints(value, row),
    source: null,
  };
}
