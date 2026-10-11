import { Svg, Polygon, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { SymmetryStatus } from "@/lib/metrics/stats";

const v = StyleSheet.create({
  wrap: { marginTop: 2 },
  trackWrap: { height: 18, position: "relative" },
  track: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 9,
  },
  seg: { flex: 1 },
  marker: { position: "absolute", top: 0, width: 12, marginLeft: -6, alignItems: "center" },
  ends: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  end: { fontSize: 6.5, color: "#6b5e4e", letterSpacing: 0.3, textTransform: "uppercase" },
  caption: { fontSize: 7.5, color: "#4d5a68", marginTop: 1 },
  captionStrong: { fontSize: 8, color: "#102a43", marginTop: 1, fontFamily: "Helvetica-Bold" },
  bars: { marginTop: 4 },
  barRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  barName: { width: 36, fontSize: 7.5, color: "#4d5a68" },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#ece6dc",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4 },
  barVal: { width: 58, fontSize: 7.5, textAlign: "right", color: "#102a43" },
});

const STRENGTH_SEGS = ["#c45c4a", "#d9783a", "#e3b23c", "#7eb24b", "#2f9e6b"];
const SYMMETRY_SEGS = ["#2f9e6b", "#7eb24b", "#e3b23c", "#d9783a", "#c45c4a"];

export function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${Math.round(n)}th`;
  switch (Math.round(n) % 10) {
    case 1:
      return `${Math.round(n)}st`;
    case 2:
      return `${Math.round(n)}nd`;
    case 3:
      return `${Math.round(n)}rd`;
    default:
      return `${Math.round(n)}th`;
  }
}

function Arrow({ color }: { color: string }) {
  return (
    <Svg width={12} height={9}>
      <Polygon points="6,9 0,0 12,0" fill={color} />
    </Svg>
  );
}

export function Spectrum({
  id,
  markers,
  highIsGood = true,
  markerLabel,
  caption,
  leftLabel,
  rightLabel,
  compact = false,
}: {
  id: string;
  markers: { position01: number; color?: string }[];
  highIsGood?: boolean;
  markerLabel?: string | null;
  caption?: string | null;
  leftLabel: string;
  rightLabel: string;
  compact?: boolean;
}) {
  const empty = markers.length === 0;
  const segs = highIsGood ? STRENGTH_SEGS : SYMMETRY_SEGS;
  return (
    <View style={v.wrap} wrap={false}>
      <View style={v.trackWrap}>
        {markers.map((m, i) => {
          const left = Math.max(0.02, Math.min(0.98, m.position01));
          return (
            <View key={`${id}-m-${i}`} style={[v.marker, { left: `${left * 100}%` }]}>
              <Arrow color={m.color ?? "#102a43"} />
            </View>
          );
        })}
        <View style={[v.track, empty ? { opacity: 0.35 } : {}]}>
          {segs.map((color) => (
            <View key={`${id}-${color}`} style={[v.seg, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
      <View style={v.ends}>
        <Text style={v.end}>{leftLabel}</Text>
        <Text style={v.end}>{rightLabel}</Text>
      </View>
      {markerLabel ? <Text style={v.captionStrong}>{markerLabel}</Text> : null}
      {!compact && caption ? <Text style={v.caption}>{caption}</Text> : null}
    </View>
  );
}

export function percentileSpectrum(
  percentile: number | null,
  caption: string | null,
  id: string,
  compact = true,
) {
  return (
    <Spectrum
      id={id}
      markers={percentile === null ? [] : [{ position01: percentile / 100 }]}
      highIsGood
      markerLabel={percentile === null ? "Reference not loaded" : `${ordinal(percentile)} percentile`}
      caption={caption}
      leftLabel="Lower"
      rightLabel="Higher"
      compact={compact}
    />
  );
}

export function dualPercentileSpectrum(
  left: number | null,
  right: number | null,
  id: string,
) {
  const markers = [
    left === null ? null : { position01: left / 100, color: "#3d6ea8" },
    right === null ? null : { position01: right / 100, color: "#2f9e6b" },
  ].filter((m): m is { position01: number; color: string } => m !== null);
  const label =
    markers.length === 0
      ? "Reference not loaded"
      : `L ${left === null ? "—" : ordinal(left)}   R ${right === null ? "—" : ordinal(right)}`;
  return (
    <Spectrum
      id={id}
      markers={markers}
      highIsGood
      markerLabel={label}
      leftLabel="Lower vs age/sex"
      rightLabel="Higher"
      compact
    />
  );
}

export function symmetrySpectrum(percent: number | null, status: SymmetryStatus, id: string) {
  const position01 = percent === null ? null : Math.min(percent / 25, 1);
  const label =
    percent === null ? null : `${percent.toFixed(1)}% difference · ${status.replaceAll("_", " ")}`;
  return (
    <Spectrum
      id={id}
      markers={position01 === null ? [] : [{ position01 }]}
      highIsGood={false}
      markerLabel={label}
      leftLabel="Even"
      rightLabel="Larger gap"
      compact
    />
  );
}

export function SideBars({
  left,
  right,
  unit = "kg",
}: {
  left: number | null;
  right: number | null;
  unit?: string;
}) {
  if (left === null && right === null) return null;
  const max = Math.max(left ?? 0, right ?? 0, 0.01);
  const rows = [
    { name: "Left", value: left, color: "#3d6ea8" },
    { name: "Right", value: right, color: "#2f9e6b" },
  ];
  return (
    <View style={v.bars}>
      {rows.map((row) => (
        <View key={row.name} style={v.barRow}>
          <Text style={v.barName}>{row.name}</Text>
          <View style={v.barTrack}>
            <View
              style={[
                v.barFill,
                {
                  width: row.value === null ? 0 : `${(row.value / max) * 100}%`,
                  backgroundColor: row.color,
                },
              ]}
            />
          </View>
          <Text style={v.barVal}>{row.value === null ? "—" : `${row.value.toFixed(1)} ${unit}`}</Text>
        </View>
      ))}
    </View>
  );
}

