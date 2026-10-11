import { Circle, Path, Svg, Text, View, StyleSheet } from "@react-pdf/renderer";

const ink = "#2c3542";
const skin = "#e8ddd0";

export type BodyHeat = {
  torso: number | null;
  leftArm: number | null;
  rightArm: number | null;
  leftHip: number | null;
  rightHip: number | null;
  leftQuad: number | null;
  rightQuad: number | null;
  leftHam: number | null;
  rightHam: number | null;
  leftCalf: number | null;
  rightCalf: number | null;
};

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", justifyContent: "space-around", marginTop: 6 },
  col: { alignItems: "center", width: 220 },
  title: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#102a43", marginBottom: 4 },
  caption: { fontSize: 7, color: "#6b5e4e", textAlign: "center", marginTop: 4, width: 150, lineHeight: 1.3 },
  legendRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  legendBar: { flexDirection: "row", height: 8, width: 120, borderRadius: 4, overflow: "hidden" },
  legendSeg: { flex: 1 },
  legendText: { fontSize: 7, color: "#6b5e4e" },
});

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const STOPS: [number, string][] = [
  [0, "#b42318"],
  [0.28, "#e85d4c"],
  [0.5, "#e3b23c"],
  [0.72, "#7eb24b"],
  [1, "#1f7a4d"],
];

export function heatColor(t: number | null) {
  if (t === null) return "#d9d1c6";
  const x = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) i += 1;
  const [t0, c0] = STOPS[i];
  const [t1, c1] = STOPS[i + 1];
  const u = t1 === t0 ? 0 : (x - t0) / (t1 - t0);
  const [r0, g0, b0] = hexToRgb(c0);
  const [r1, g1, b1] = hexToRgb(c1);
  return rgbToHex(lerp(r0, r1, u), lerp(g0, g1, u), lerp(b0, b1, u));
}

function Region({ d, heat }: { d: string; heat: number | null }) {
  return <Path d={d} fill={heatColor(heat)} stroke={ink} strokeWidth={0.7} />;
}

function FrontBody({ heat, width = 160, height = 340 }: { heat: BodyHeat; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 430">
      <Circle cx="100" cy="32" r="24" fill={skin} stroke={ink} strokeWidth={0.8} />
      <Path d="M90 54 L110 54 L108 74 L92 74 Z" fill={skin} stroke={ink} strokeWidth={0.7} />
      <Region
        heat={heat.torso}
        d="M80 76 C68 90 64 118 68 152 L72 176 L128 176 L132 152 C136 118 132 90 120 76 C112 68 88 68 80 76 Z"
      />
      <Path
        d="M100 92 L100 160 M86 108 C94 112 106 112 114 108 M84 128 C94 134 106 134 116 128"
        fill="none"
        stroke={ink}
        strokeWidth={0.35}
      />
      <Region
        heat={heat.leftArm}
        d="M78 82 C56 92 46 118 46 146 C46 170 50 196 56 212 L72 208 C70 184 70 160 74 132 L84 96 Z"
      />
      <Region
        heat={heat.rightArm}
        d="M122 82 C144 92 154 118 154 146 C154 170 150 196 144 212 L128 208 C130 184 130 160 126 132 L116 96 Z"
      />
      <Region heat={heat.leftHip} d="M72 172 C62 182 60 198 66 214 L98 218 L102 176 Z" />
      <Region heat={heat.rightHip} d="M128 172 C138 182 140 198 134 214 L102 218 L98 176 Z" />
      <Region
        heat={heat.leftQuad}
        d="M68 212 C62 244 64 278 72 308 L98 308 C104 270 102 236 98 218 Z"
      />
      <Region
        heat={heat.rightQuad}
        d="M132 212 C138 244 136 278 128 308 L102 308 C96 270 98 236 102 218 Z"
      />
      <Path d="M82 230 L90 300 M118 230 L110 300" fill="none" stroke={ink} strokeWidth={0.3} />
      <Region heat={heat.leftCalf} d="M74 306 C70 338 74 368 80 388 L96 388 C100 356 100 328 96 308 Z" />
      <Region heat={heat.rightCalf} d="M126 306 C130 338 126 368 120 388 L104 388 C100 356 100 328 104 308 Z" />
      <Path d="M78 386 L72 404 L98 404 L96 386 Z" fill={skin} stroke={ink} strokeWidth={0.6} />
      <Path d="M122 386 L128 404 L102 404 L104 386 Z" fill={skin} stroke={ink} strokeWidth={0.6} />
    </Svg>
  );
}

function BackBody({ heat, width = 160, height = 340 }: { heat: BodyHeat; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 430">
      <Circle cx="100" cy="32" r="24" fill={skin} stroke={ink} strokeWidth={0.8} />
      <Path d="M90 54 L110 54 L108 74 L92 74 Z" fill={skin} stroke={ink} strokeWidth={0.7} />
      <Region
        heat={heat.torso}
        d="M80 76 C68 90 64 118 68 150 L74 178 L126 178 L132 150 C136 118 132 90 120 76 C112 68 88 68 80 76 Z"
      />
      <Path d="M100 80 L100 170 M84 120 L116 120" fill="none" stroke={ink} strokeWidth={0.35} />
      <Region
        heat={heat.leftArm}
        d="M78 82 C56 92 46 118 46 146 C46 170 50 196 56 212 L72 208 C70 184 70 160 74 132 L84 96 Z"
      />
      <Region
        heat={heat.rightArm}
        d="M122 82 C144 92 154 118 154 146 C154 170 150 196 144 212 L128 208 C130 184 130 160 126 132 L116 96 Z"
      />
      <Region heat={heat.leftHip} d="M74 174 C60 186 58 206 70 222 L100 224 L102 176 Z" />
      <Region heat={heat.rightHip} d="M126 174 C140 186 142 206 130 222 L100 224 L98 176 Z" />
      <Region
        heat={heat.leftHam}
        d="M70 220 C64 252 66 286 74 310 L98 310 C102 274 102 240 100 224 Z"
      />
      <Region
        heat={heat.rightHam}
        d="M130 220 C136 252 134 286 126 310 L102 310 C98 274 98 240 100 224 Z"
      />
      <Region heat={heat.leftCalf} d="M76 308 C72 340 76 370 82 388 L98 388 C100 356 100 330 98 310 Z" />
      <Region heat={heat.rightCalf} d="M124 308 C128 340 124 370 118 388 L102 388 C100 356 100 330 102 310 Z" />
      <Path d="M80 386 L74 404 L100 404 L98 386 Z" fill={skin} stroke={ink} strokeWidth={0.6} />
      <Path d="M120 386 L126 404 L100 404 L102 386 Z" fill={skin} stroke={ink} strokeWidth={0.6} />
    </Svg>
  );
}

export function AnatomicalHeatMaps({
  attention,
  title,
  caption,
  compact = false,
}: {
  attention: BodyHeat;
  title?: string;
  caption?: string;
  compact?: boolean;
}) {
  const w = compact ? 110 : 160;
  const h = compact ? 234 : 340;
  return (
    <View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.wrap}>
        <View style={styles.col}>
          <Text style={styles.title}>Front</Text>
          <FrontBody heat={attention} width={w} height={h} />
          {!compact ? (
            <Text style={styles.caption}>Quads, hips, arms. Red is the next focus. Green is going well.</Text>
          ) : null}
        </View>
        <View style={styles.col}>
          <Text style={styles.title}>Back</Text>
          <BackBody heat={attention} width={w} height={h} />
          {!compact ? (
            <Text style={styles.caption}>Hamstrings and hips from behind. Same colour scale.</Text>
          ) : null}
        </View>
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Priority</Text>
        <View style={styles.legendBar}>
          {STOPS.map(([t, c]) => (
            <View key={String(t)} style={[styles.legendSeg, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.legendText}>Favourable</Text>
        <Text style={styles.legendText}>   Grey = not tested / no matching reference</Text>
      </View>
    </View>
  );
}

export function LayerMaps({
  strength,
  symmetry,
  mobility,
}: {
  strength: BodyHeat;
  symmetry: BodyHeat;
  mobility: BodyHeat;
}) {
  const layers: [string, BodyHeat][] = [
    ["Strength", strength],
    ["Symmetry", symmetry],
    ["Mobility", mobility],
  ];
  return (
    <View>
      <View style={styles.wrap}>
        {layers.map(([label, heat]) => (
          <View key={label} style={[styles.col, { width: 170 }]}>
            <Text style={styles.title}>{label}</Text>
            <FrontBody heat={heat} width={120} height={250} />
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Priority</Text>
        <View style={styles.legendBar}>
          {STOPS.map(([t, c]) => (
            <View key={String(t)} style={[styles.legendSeg, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.legendText}>Favourable · Grey = not assessed / no matching reference</Text>
      </View>
    </View>
  );
}

export function pctHeat(percentile: number | null | undefined) {
  if (percentile == null) return null;
  return Math.max(0, Math.min(1, percentile / 100));
}

export function symmetryHeat(asymmetry: number | null | undefined, isWeakerSide: boolean) {
  if (asymmetry == null) return null;
  if (!isWeakerSide) return 0.86;
  return 1 - Math.min(asymmetry / 25, 1);
}

export function blendHeat(a: number | null, b: number | null) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}
