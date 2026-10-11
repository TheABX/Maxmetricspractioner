import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Compact view of the assessment the program is built from: headline values
 * and the flags that should drive exercise selection. Read-only.
 */
export async function AssessmentSnapshot({ sessionId }: { sessionId: string }) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("id, assessment_date, assessment_type, bodyweight_kg, test_instances(id, test_type, movement_name, is_invalid)")
    .eq("id", sessionId)
    .single();
  if (!session) return null;

  const tests = (session.test_instances as { id: string; test_type: string; movement_name: string | null; is_invalid: boolean }[]) ?? [];
  const ids = tests.map((t) => t.id);

  const [{ data: fp }, { data: iso }, { data: mob }, { data: squat }] = await Promise.all([
    supabase
      .from("force_plate_results")
      .select("test_instance_id, peak_force_kg, relative_peak_force, peak_force_asymmetry_percent, weaker_side")
      .in("test_instance_id", ids),
    supabase
      .from("isometric_results")
      .select("test_instance_id, best_left_peak_force, best_right_peak_force, best_bilateral_peak_force, asymmetry_percent, weaker_side, symmetry_status, population_strength_status")
      .in("test_instance_id", ids),
    supabase
      .from("mobility_results")
      .select("test_instance_id, unit, left_value, right_value, symmetry_status, population_status, interpretation")
      .in("test_instance_id", ids),
    supabase.from("mobility_observations").select("test_instance_id, depth_achieved, pain_reported").in("test_instance_id", ids),
  ]);

  const name = (id: string) => {
    const t = tests.find((x) => x.id === id);
    return t?.movement_name ?? t?.test_type.replaceAll("_", " ") ?? "";
  };
  const fmt = (v: number | null | undefined, d = 1) => (v == null ? "—" : Number(v).toFixed(d));

  return (
    <div className="mt-2 font-sans text-sm">
      <p>
        <Link className="underline" href={`/assessments/${session.id}`}>
          {session.assessment_date} · {session.assessment_type.replaceAll("_", " ")}
        </Link>{" "}
        <span className="text-[var(--muted)]">· {session.bodyweight_kg} kg</span>
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {(fp ?? []).map((r) => (
          <li key={r.test_instance_id}>
            <strong>{name(r.test_instance_id)}</strong> {fmt(r.peak_force_kg)} kg · {fmt(r.relative_peak_force, 2)}× BW
            {r.peak_force_asymmetry_percent != null
              ? ` · asym ${fmt(r.peak_force_asymmetry_percent)}%${r.weaker_side ? ` (${r.weaker_side} weaker)` : ""}`
              : ""}
          </li>
        ))}
        {(iso ?? []).map((r) => (
          <li key={r.test_instance_id}>
            <strong>{name(r.test_instance_id)}</strong>{" "}
            {r.best_left_peak_force != null || r.best_right_peak_force != null
              ? `L ${fmt(r.best_left_peak_force)} / R ${fmt(r.best_right_peak_force)} kg`
              : `${fmt(r.best_bilateral_peak_force)} kg`}
            {r.asymmetry_percent != null ? ` · ${fmt(r.asymmetry_percent)}%${r.weaker_side ? ` (${r.weaker_side} weaker)` : ""}` : ""}
            {r.population_strength_status && r.population_strength_status !== "reference_pending"
              ? ` · ${String(r.population_strength_status).replaceAll("_", " ")}`
              : ""}
          </li>
        ))}
        {(mob ?? []).map((r) => {
          const interp = (r.interpretation as { programming?: string } | null) ?? {};
          const implication = interp.programming;
          return (
            <li key={r.test_instance_id}>
              <strong>{name(r.test_instance_id)}</strong> L {fmt(r.left_value)} / R {fmt(r.right_value)} {r.unit ?? ""}
              {r.symmetry_status && r.symmetry_status !== "unavailable" ? ` · ${String(r.symmetry_status).replaceAll("_", " ")}` : ""}
              {r.population_status && r.population_status !== "reference_pending"
                ? ` · ${String(r.population_status).replaceAll("_", " ")}`
                : ""}
              {implication ? <span className="block text-[var(--muted)]">{implication}</span> : null}
            </li>
          );
        })}
        {(squat ?? []).map((r) => (
          <li key={r.test_instance_id}>
            <strong>Overhead squat</strong> depth {String(r.depth_achieved ?? "—").replaceAll("_", " ")}
            {r.pain_reported && r.pain_reported !== "NO" ? ` · pain: ${String(r.pain_reported).replaceAll("_", " ")}` : ""}
          </li>
        ))}
        {tests.filter((t) => t.is_invalid).length > 0 && (
          <li className="text-[var(--muted)]">{tests.filter((t) => t.is_invalid).length} test(s) marked invalid.</li>
        )}
      </ul>
    </div>
  );
}
