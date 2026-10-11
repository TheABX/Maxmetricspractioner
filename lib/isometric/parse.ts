import { classifyForcePlateHeaders } from "@/lib/force-plate/parse";

export type IsoParseWarning = { level: "error" | "warning"; message: string };

export function inspectIsometricWorkbook(headers: string[]): {
  fileType: "FORCE_PLATE_EXPORT_V1" | "ISOMETRIC_GENERIC_V1" | "UNKNOWN";
  warnings: IsoParseWarning[];
} {
  if (classifyForcePlateHeaders(headers)) {
    return {
      fileType: "FORCE_PLATE_EXPORT_V1",
      warnings: [
        {
          level: "error",
          message:
            "This file matches the force-plate exporter. Upload it in the Force Plate module so that importer stays separate.",
        },
      ],
    };
  }
  const compact = headers.map((h) => h.replace(/\s+/g, "").toLowerCase());
  const hasPeak = compact.some((h) => h.includes("peakforce") || h.includes("峰值力"));
  const hasSide = compact.some((h) => h === "l/r" || h === "side" || h === "lr");
  if (hasPeak && hasSide) {
    return {
      fileType: "ISOMETRIC_GENERIC_V1",
      warnings: [
        {
          level: "warning",
          message:
            "Generic isometric columns were detected. Only headings present in the file will be stored. Missing device fields remain null.",
        },
      ],
    };
  }
  return {
    fileType: "UNKNOWN",
    warnings: [
      {
        level: "error",
        message:
          "This workbook is not a recognised isometric export. Enter trials manually, or provide a genuine equipment file so the importer can be mapped from real headings.",
      },
    ],
  };
}
