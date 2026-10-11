import type { AdaptationResult, Traffic } from "@/lib/adaptation-engine/types";

export function AdaptationBoard({ result, compact = false }: { result: AdaptationResult; compact?: boolean }) {
  return (
    <div className="grid gap-3">
      <TrafficLine result={result} />
      {!compact &&
        result.exercises.map((e) => (
          <div key={e.slot_id} className="font-sans text-sm">
            <span className="font-medium">{e.name}</span>
            <span className="text-[var(--muted)]">
              {" "}
              · {e.state} · {e.action.replaceAll("_", " ").toLowerCase()} · {e.confidence.toLowerCase()} confidence
            </span>
            {e.proposed ? <p className="text-xs text-[var(--muted)]">{e.proposed.current} → {e.proposed.proposed}</p> : null}
          </div>
        ))}
    </div>
  );
}

export function TrafficLine({ result }: { result: AdaptationResult }) {
  const c = result.client;
  return (
    <div>
      <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {c.traffic} · {c.fortnightly_outcome.replaceAll("_", " ")} · {c.adherence_band.toLowerCase()} adherence
      </p>
      <p className="mt-1 font-sans text-sm">{c.summary}</p>
    </div>
  );
}

export function TrafficDot({ value }: { value: Traffic }) {
  const color = value === "RED" ? "bg-red-600" : value === "AMBER" ? "bg-amber-500" : "bg-emerald-600";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} title={value} />;
}
